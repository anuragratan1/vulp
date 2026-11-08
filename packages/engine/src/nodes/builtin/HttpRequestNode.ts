import dns from 'node:dns/promises';
import net from 'node:net';
import { ConfigError, Json, NodeError, ParamField, RunContext } from '../../contracts.js';
import { ActionNode } from '../base/ActionNode.js';

export function isPrivateIp(ip: string): boolean {
  // IPv4 mapped to IPv6 check
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return true;

    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 100.64.0.0/10 (Carrier NAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;

    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // Loopback ::1
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
    // Link-local fe80::/10
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
      return true;
    }
    // Unique local address fc00::/7 (fc00 - fdff)
    if (lower.startsWith('fc') || lower.startsWith('fd')) {
      return true;
    }
    return false;
  }

  return true;
}

export class HttpRequestNode extends ActionNode {
  readonly type = 'http.request';
  readonly label = 'HTTP Request';
  readonly credentialType = 'http';
  readonly params: ParamField[] = [
    {
      name: 'method',
      label: 'HTTP Method',
      kind: 'select',
      required: true,
      default: 'GET',
      options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
    {
      name: 'url',
      label: 'URL',
      kind: 'string',
      required: true,
    },
    {
      name: 'headers',
      label: 'Headers',
      kind: 'json',
      required: false,
      default: {},
    },
    {
      name: 'body',
      label: 'Request Body',
      kind: 'json',
      required: false,
    },
    {
      name: 'timeoutMs',
      label: 'Timeout (ms)',
      kind: 'number',
      required: false,
      default: 30000,
    },
  ];

  /**
   * Validate destination URL and resolve DNS to block SSRF to private/link-local addresses
   * when production SSRF protection is enabled.
   */
  private async validateUrl(urlString: string): Promise<URL> {
    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      throw new ConfigError(`Invalid URL provided: '${urlString}'`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ConfigError(`Unsupported protocol '${parsed.protocol}'. Only http and https are allowed.`);
    }

    const enforceSsrfProtection =
      process.env.NODE_ENV === 'production' || process.env.ENFORCE_SSRF_PROTECTION === 'true';

    if (enforceSsrfProtection) {
      const hostname = parsed.hostname;
      if (net.isIP(hostname)) {
        if (isPrivateIp(hostname)) {
          throw new ConfigError(
            `Access to private, loopback, or link-local address '${hostname}' is prohibited.`
          );
        }
      } else {
        try {
          const lookupResults = await dns.lookup(hostname, { all: true });
          for (const addr of lookupResults) {
            if (isPrivateIp(addr.address)) {
              throw new ConfigError(
                `Access to private address '${addr.address}' for host '${hostname}' is prohibited.`
              );
            }
          }
        } catch (dnsErr: any) {
          throw new NodeError(`DNS resolution failed for '${hostname}': ${dnsErr.message}`, true);
        }
      }
    }

    return parsed;
  }

  protected async perform(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json> {
    const rawUrl = String(params.url || '');
    if (!rawUrl) {
      throw new ConfigError("Parameter 'url' is required for HTTP Request.");
    }

    const method = String(params.method || 'GET').toUpperCase();
    const timeoutMs = Math.min(Math.max(100, Number(params.timeoutMs) || 30000), 30000);

    const headers: Record<string, string> = {};
    if (params.headers && typeof params.headers === 'object' && !Array.isArray(params.headers)) {
      for (const [k, v] of Object.entries(params.headers)) {
        headers[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      }
    }

    // Apply credentials/secrets if provided
    if (secrets && Object.keys(secrets).length > 0) {
      if (secrets.apiKey) {
        const headerName = secrets.headerName || 'x-api-key';
        headers[headerName] = secrets.apiKey;
      } else if (secrets.token) {
        headers['authorization'] = secrets.token.startsWith('Bearer ')
          ? secrets.token
          : `Bearer ${secrets.token}`;
      } else if (secrets.username && secrets.password) {
        headers['authorization'] =
          'Basic ' + Buffer.from(`${secrets.username}:${secrets.password}`).toString('base64');
      } else if (secrets.authHeader) {
        headers['authorization'] = secrets.authHeader;
      }

      // Allow generic header injection (e.g. key prefixed with header:)
      for (const [k, v] of Object.entries(secrets)) {
        if (k.toLowerCase().startsWith('header:') && typeof v === 'string') {
          headers[k.substring(7).trim()] = v;
        }
      }
    }

    let bodyPayload: string | undefined = undefined;
    if (method !== 'GET' && method !== 'HEAD' && params.body !== undefined && params.body !== null) {
      if (typeof params.body === 'string') {
        bodyPayload = params.body;
      } else {
        bodyPayload = JSON.stringify(params.body);
        if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
          headers['content-type'] = 'application/json';
        }
      }
    }

    // SSRF safe request execution with redirect handling
    let currentUrl = rawUrl;
    let redirectCount = 0;
    const maxRedirects = 5;

    while (true) {
      const validUrl = await this.validateUrl(currentUrl);

      ctx.log('info', `HTTP ${method} ${validUrl.toString()}`);

      const timeoutController = new AbortController();
      const timer = setTimeout(() => {
        timeoutController.abort(new Error(`HTTP request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const abortListener = () => {
        timeoutController.abort(ctx.signal.reason);
      };
      ctx.signal.addEventListener('abort', abortListener, { once: true });

      let response: Response;
      try {
        response = await fetch(validUrl, {
          method,
          headers,
          body: bodyPayload,
          signal: timeoutController.signal,
          redirect: 'manual', // Manual redirect to validate each destination
        });
      } catch (networkErr: any) {
        if (timeoutController.signal.aborted) {
          throw new NodeError(`Request timeout (${timeoutMs}ms)`, true);
        }
        if (ctx.signal.aborted) {
          throw ctx.signal.reason ?? new Error('Aborted');
        }
        throw new NodeError(`Network error: ${networkErr.message}`, true);
      } finally {
        clearTimeout(timer);
        ctx.signal.removeEventListener('abort', abortListener);
      }

      // Handle redirects securely
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new NodeError(`Received redirect status ${response.status} with missing Location header`, false);
        }
        redirectCount++;
        if (redirectCount > maxRedirects) {
          throw new NodeError('Exceeded maximum redirect limit (5)', false);
        }
        currentUrl = new URL(location, validUrl).toString();
        ctx.log('info', `Following redirect (${redirectCount}) to ${currentUrl}`);
        continue;
      }

      // Check HTTP status code and classify errors
      const status = response.status;
      let responseBody: Json = null;
      const contentType = response.headers.get('content-type') || '';

      const text = await response.text();
      if (text.trim().length > 0) {
        if (contentType.includes('application/json')) {
          try {
            responseBody = JSON.parse(text);
          } catch {
            responseBody = text;
          }
        } else {
          try {
            responseBody = JSON.parse(text);
          } catch {
            responseBody = text;
          }
        }
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        responseHeaders[key] = val;
      });

      const resultOutput: Json = {
        status,
        statusText: response.statusText,
        headers: responseHeaders,
        data: responseBody,
      };

      if (status >= 400) {
        ctx.log('error', `HTTP ${status}: ${response.statusText}`);

        if (status === 429) {
          throw new NodeError(`HTTP 429 Too Many Requests: ${JSON.stringify(responseBody)}`, true);
        }

        if (status >= 400 && status < 500) {
          // HTTP 4xx (except 429) is non-retryable
          throw new NodeError(`HTTP ${status} Client Error: ${JSON.stringify(responseBody)}`, false);
        }

        if (status >= 500) {
          // HTTP 5xx is retryable
          throw new NodeError(`HTTP ${status} Server Error: ${JSON.stringify(responseBody)}`, true);
        }
      }

      return resultOutput;
    }
  }
}

