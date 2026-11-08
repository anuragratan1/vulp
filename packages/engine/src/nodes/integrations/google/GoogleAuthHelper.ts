import { ConfigError, NodeError, RunContext } from '../../../contracts.js';

export interface GoogleAuthSecrets {
  accessToken: string;
  refreshToken?: string;
  email?: string;
}

export class GoogleAuthHelper {
  public static extractAccessToken(secrets: Record<string, string>): string {
    const token = secrets.accessToken || secrets.token || secrets.access_token || secrets.apiKey;
    if (!token || !token.trim()) {
      throw new ConfigError(
        'Google account is not connected. Please select or connect a Google account in the step settings.'
      );
    }
    return token.trim();
  }

  public static async fetchGoogle(
    url: string,
    options: RequestInit,
    secrets: Record<string, string>,
    ctx: RunContext,
    serviceName = 'Google'
  ): Promise<any> {
    const token = this.extractAccessToken(secrets);

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    const timeoutController = new AbortController();
    const timer = setTimeout(() => {
      timeoutController.abort(new Error(`${serviceName} request timed out after 15000ms`));
    }, 15000);

    const abortListener = () => {
      timeoutController.abort(ctx.signal.reason);
    };
    ctx.signal.addEventListener('abort', abortListener, { once: true });

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: timeoutController.signal,
      });
    } catch (netErr: any) {
      if (timeoutController.signal.aborted) {
        throw new NodeError(
          `${serviceName} request timed out or was aborted: ${netErr?.message}`,
          true
        );
      }
      throw new NodeError(
        `Network error communicating with ${serviceName}: ${netErr?.message}`,
        true
      );
    } finally {
      clearTimeout(timer);
      ctx.signal.removeEventListener('abort', abortListener);
    }

    let resultJson: any = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        resultJson = await response.json();
      } catch {
        // response may be non-json or empty
      }
    } else {
      const text = await response.text();
      try {
        resultJson = JSON.parse(text);
      } catch {
        resultJson = { message: text };
      }
    }

    const errorMsg =
      resultJson?.error?.message ||
      resultJson?.error_description ||
      resultJson?.message ||
      response.statusText;

    if (response.status === 401) {
      throw new NodeError(
        `${serviceName} authorization expired or invalid (401): ${errorMsg}. Please reconnect your account.`,
        false
      );
    }

    if (response.status === 403) {
      throw new NodeError(
        `${serviceName} permission denied (403): ${errorMsg}. Ensure appropriate permissions/scopes are granted.`,
        false
      );
    }

    if (response.status === 404) {
      throw new NodeError(
        `${serviceName} resource not found (404): ${errorMsg}.`,
        false
      );
    }

    if (response.status === 429) {
      throw new NodeError(
        `${serviceName} rate limit exceeded (429): ${errorMsg}.`,
        true
      );
    }

    if (response.status >= 500) {
      throw new NodeError(
        `${serviceName} server error (${response.status}): ${errorMsg}.`,
        true
      );
    }

    if (!response.ok) {
      throw new NodeError(
        `${serviceName} API request failed (${response.status}): ${errorMsg}`,
        false
      );
    }

    return resultJson;
  }
}

