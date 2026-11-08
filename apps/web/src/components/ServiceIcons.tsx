import React from 'react';
import {
  Layers,
  Play,
  Webhook,
  Clock,
  Globe,
  GitBranch,
  GitMerge,
} from 'lucide-react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Official Google Multi-Color "G" Logo
 */
export function GoogleIcon({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Google"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

/**
 * Official Google Workspace Gmail 2020 5-color "M" Logo
 */
export function GmailIcon({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="52 42 88 66"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Gmail"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"
        fill="#4285F4"
      />
      <path
        d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"
        fill="#34A853"
      />
      <path
        d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"
        fill="#FBBC04"
      />
      <path
        d="M72 74V48l24 18 24-18v26L96 92"
        fill="#EA4335"
      />
      <path
        d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"
        fill="#C5221F"
      />
    </svg>
  );
}

/**
 * Official Google Workspace Sheets 2020 Green Document & Table Grid Logo
 */
export function GoogleSheetsIcon({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Google Sheets"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M 42,0 64,22 53,24 42,22 40,11 Z"
        fill="#188038"
      />
      <path
        d="M 42,22 V 0 H 6 C 2.685,0 0,2.685 0,6 v 76 c 0,3.315 2.685,6 6,6 h 52 c 3.315,0 6,-2.685 6,-6 V 22 Z"
        fill="#34A853"
      />
      <path
        d="M 12,34 V 63 H 52 V 34 Z M 29.5,58 H 17 v -7 h 12.5 z m 0,-12 H 17 V 39 H 29.5 Z M 47,58 H 34.5 V 51 H 47 Z M 47,46 H 34.5 V 39 H 47 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/**
 * Official Google Forms Purple Icon
 */
export function GoogleFormsIcon({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Google Forms"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <rect x="4" y="2" width="16" height="20" rx="2.5" fill="#7248B9" />
      {/* Top list item */}
      <circle cx="8" cy="8" r="1.25" fill="#FFFFFF" />
      <rect x="11" y="7.25" width="6" height="1.5" rx="0.75" fill="#FFFFFF" />
      {/* Middle list item */}
      <circle cx="8" cy="12" r="1.25" fill="#FFFFFF" />
      <rect x="11" y="11.25" width="6" height="1.5" rx="0.75" fill="#FFFFFF" />
      {/* Bottom list item */}
      <circle cx="8" cy="16" r="1.25" fill="#FFFFFF" />
      <rect x="11" y="15.25" width="6" height="1.5" rx="0.75" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * Official Google Workspace Drive 2020 6-Piece Interlocking Triangular Loop
 */
export function GoogleDriveIcon({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 87.3 78"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Google Drive"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066DA"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00AC47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#EA4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832D"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684FC"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#FFBA00"
      />
    </svg>
  );
}

/**
 * Official Google Workspace Calendar 2020 Multi-Color Frame & "31" Icon
 */
export function GoogleCalendarIcon({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Google Calendar"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <g transform="translate(3.75 3.75)">
        <path
          fill="#FFFFFF"
          d="M148.882,43.618l-47.368-5.263l-57.895,5.263L38.355,96.25l5.263,52.632l52.632,6.579l52.632-6.579l5.263-53.947L148.882,43.618z"
        />
        <path
          fill="#1A73E8"
          d="M65.211,125.276c-3.934-2.658-6.658-6.539-8.145-11.671l9.132-3.763c0.829,3.158,2.276,5.605,4.342,7.342c2.053,1.737,4.553,2.592,7.474,2.592c2.987,0,5.553-0.908,7.697-2.724s3.224-4.132,3.224-6.934c0-2.868-1.132-5.211-3.395-7.026s-5.105-2.724-8.5-2.724h-5.276v-9.039H76.5c2.921,0,5.382-0.789,7.382-2.368c2-1.579,3-3.737,3-6.487c0-2.447-0.895-4.395-2.684-5.855s-4.053-2.197-6.803-2.197c-2.684,0-4.816,0.711-6.395,2.145s-2.724,3.197-3.447,5.276l-9.039-3.763c1.197-3.395,3.395-6.395,6.618-8.987c3.224-2.592,7.342-3.895,12.342-3.895c3.697,0,7.026,0.711,9.974,2.145c2.947,1.434,5.263,3.421,6.934,5.947c1.671,2.539,2.5,5.382,2.5,8.539c0,3.224-0.776,5.947-2.329,8.184c-1.553,2.237-3.461,3.947-5.724,5.145v0.539c2.987,1.25,5.421,3.158,7.342,5.724c1.908,2.566,2.868,5.632,2.868,9.211s-0.908,6.776-2.724,9.579c-1.816,2.803-4.329,5.013-7.513,6.618c-3.197,1.605-6.789,2.421-10.776,2.421C73.408,129.263,69.145,127.934,65.211,125.276z"
        />
        <path
          fill="#1A73E8"
          d="M121.25,79.961l-9.974,7.25l-5.013-7.605l17.987-12.974h6.895v61.197h-9.895L121.25,79.961z"
        />
        <path
          fill="#EA4335"
          d="M148.882,196.25l47.368-47.368l-23.684-10.526l-23.684,10.526l-10.526,23.684L148.882,196.25z"
        />
        <path
          fill="#34A853"
          d="M33.092,172.566l10.526,23.684h105.263v-47.368H43.618L33.092,172.566z"
        />
        <path
          fill="#4285F4"
          d="M12.039-3.75C3.316-3.75-3.75,3.316-3.75,12.039v136.842l23.684,10.526l23.684-10.526V43.618h105.263l10.526-23.684L148.882-3.75H12.039z"
        />
        <path
          fill="#188038"
          d="M-3.75,148.882v31.579c0,8.724,7.066,15.789,15.789,15.789h31.579v-47.368H-3.75z"
        />
        <path
          fill="#FBBC04"
          d="M148.882,43.618v105.263h47.368V43.618l-23.684-10.526L148.882,43.618z"
        />
        <path
          fill="#1967D2"
          d="M196.25,43.618V12.039c0-8.724-7.066-15.789-15.789-15.789h-31.579v47.368H196.25z"
        />
      </g>
    </svg>
  );
}

/**
 * Official Telegram Circular Badge & Paper Airplane Logo
 */
export function TelegramIcon({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Telegram"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="vulp-tg-gradient" x1="120" y1="240" x2="120" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1D93D2" />
          <stop offset="1" stopColor="#38B0E3" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="120" r="120" fill="url(#vulp-tg-gradient)" />
      <path
        d="M81.229 128.772l14.237 39.406s1.78 3.687 3.686 3.687 30.255-29.492 30.255-29.492l31.525-60.89L81.737 118.6z"
        fill="#C8DAEA"
      />
      <path
        d="M100.106 138.878l-2.733 29.046s-1.144 8.9 7.754 0 17.415-15.763 17.415-15.763"
        fill="#A9C6D8"
      />
      <path
        d="M81.486 130.178L52.2 120.636s-3.5-1.42-2.373-4.64c.232-.664.7-1.229 2.1-2.2 6.489-4.523 120.106-45.36 120.106-45.36s3.208-1.081 5.1-.362a2.766 2.766 0 011.885 2.055 9.357 9.357 0 01.254 2.585c-.009.752-.1 1.449-.169 2.542-.692 11.165-21.4 94.493-21.4 94.493s-1.239 4.876-5.678 5.043A8.13 8.13 0 01146.1 172.5c-8.711-7.493-38.819-27.727-45.472-32.177a1.27 1.27 0 01-.546-.9c-.093-.469.417-1.05.417-1.05s52.426-46.6 53.821-51.492c.108-.379-.3-.566-.848-.4-3.482 1.281-63.844 39.4-70.506 43.607a3.21 3.21 0 01-1.748.513z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/**
 * Official Slack 2019 4-Color Octothorpe Pinwheels Logo
 */
export function SlackIcon({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 127 127"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Slack"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z"
        fill="#E01E5A"
      />
      <path
        d="M47 27c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.5 39.7.6 47 .6c7.3 0 13.2 5.9 13.2 13.2V27H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H13.9C6.6 60.1.7 54.2.7 46.9c0-7.3 5.9-13.2 13.2-13.2H47z"
        fill="#36C5F0"
      />
      <path
        d="M99.9 46.9c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V46.9zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V13.8C66.9 6.5 72.8.6 80.1.6c7.3 0 13.2 5.9 13.2 13.2v33.1z"
        fill="#2EB67D"
      />
      <path
        d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80.1z"
        fill="#ECB22E"
      />
    </svg>
  );
}

/**
 * Official GitHub Octocat Silhouette Logo (Theme Adaptive)
 */
export function GitHubIcon({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="GitHub"
      className={`shrink-0 ${className || 'text-text-primary dark:text-white'}`}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"
      />
    </svg>
  );
}

/**
 * Universal Service & Node Icon Resolver
 *
 * Single source of truth dispatching authentic brand SVGs for external integrations
 * and standardized icon glyphs for VULP native engine nodes.
 */
export function ServiceIcon({
  service,
  size = 16,
  className = '',
  ...props
}: {
  service: string;
  size?: number;
  className?: string;
} & React.SVGProps<SVGSVGElement>) {
  const s = (service || '').toLowerCase().trim();

  // 1. Official Integration Services
  if (s.includes('form')) {
    return <GoogleFormsIcon size={size} className={className} {...props} />;
  }
  if (s.includes('gmail')) {
    return <GmailIcon size={size} className={className} {...props} />;
  }
  if (s.includes('sheet')) {
    return <GoogleSheetsIcon size={size} className={className} {...props} />;
  }
  if (s.includes('drive')) {
    return <GoogleDriveIcon size={size} className={className} {...props} />;
  }
  if (s.includes('calendar')) {
    return <GoogleCalendarIcon size={size} className={className} {...props} />;
  }
  if (s === 'google' || s.startsWith('google.') || s.includes('workspace')) {
    return <GoogleIcon size={size} className={className} {...props} />;
  }
  if (s.includes('telegram')) {
    return <TelegramIcon size={size} className={className} {...props} />;
  }
  if (s.includes('slack')) {
    return <SlackIcon size={size} className={className} {...props} />;
  }
  if (s.includes('github')) {
    return <GitHubIcon size={size} className={className} {...props} />;
  }

  // 2. VULP Native Nodes System
  if (s.includes('manual')) {
    return <Play size={size} className={`text-accent shrink-0 ${className}`} />;
  }
  if (s.includes('webhook')) {
    return <Webhook size={size} className={`text-[#8B5CF6] shrink-0 ${className}`} />;
  }
  if (s.includes('schedule') || s.includes('cron')) {
    return <Clock size={size} className={`text-[#06B6D4] shrink-0 ${className}`} />;
  }
  if (s.includes('http')) {
    return <Globe size={size} className={`text-[#3B82F6] shrink-0 ${className}`} />;
  }
  if (s === 'logic.if' || s.includes('if')) {
    return <GitBranch size={size} className={`text-[#EC4899] shrink-0 ${className}`} />;
  }
  if (s === 'logic.merge' || s.includes('merge')) {
    return <GitMerge size={size} className={`text-[#10B981] shrink-0 ${className}`} />;
  }
  if (s === 'logic.delay' || s.includes('delay')) {
    return <Clock size={size} className={`text-[#6366F1] shrink-0 ${className}`} />;
  }

  // 3. Consistent Fallback Icon
  return <Layers size={size} className={`text-text-muted shrink-0 ${className}`} />;
}

/**
 * Returns authentic brand hex accent color for services and native steps
 */
export function getServiceBrandColor(service: string): string {
  const s = (service || '').toLowerCase().trim();
  if (s.includes('form')) return '#7248B9';
  if (s.includes('gmail')) return '#EA4335';
  if (s.includes('sheet')) return '#0F9D58';
  if (s.includes('drive')) return '#4285F4';
  if (s.includes('calendar')) return '#1A73E8';
  if (s === 'google' || s.startsWith('google.') || s.includes('workspace')) return '#4285F4';
  if (s.includes('telegram')) return '#24A1DE';
  if (s.includes('slack')) return '#E01E5A';
  if (s.includes('github')) return '#24292F';

  // Native VULP nodes
  if (s.includes('manual')) return '#FF7306';
  if (s.includes('webhook')) return '#8B5CF6';
  if (s.includes('schedule')) return '#06B6D4';
  if (s.includes('http')) return '#3B82F6';
  if (s.includes('if')) return '#EC4899';
  if (s.includes('merge')) return '#10B981';
  if (s.includes('delay')) return '#6366F1';

  return '#A3A3A3';
}

/**
 * Returns human-readable service display name
 */
export function getServiceDisplayName(service: string): string {
  const s = (service || '').toLowerCase().trim();
  if (s === 'google_forms.trigger' || s === 'forms.trigger' || s.includes('forms')) return 'Google Forms Trigger';
  if (s.includes('gmail')) return 'Gmail';
  if (s.includes('sheet')) return 'Google Sheets';
  if (s.includes('drive')) return 'Google Drive';
  if (s.includes('calendar')) return 'Google Calendar';
  if (s === 'google' || s.startsWith('google.') || s.includes('workspace')) return 'Google Workspace';
  if (s.includes('telegram')) return 'Telegram';
  if (s.includes('slack')) return 'Slack';
  if (s.includes('github')) return 'GitHub';

  // Native nodes
  if (s === 'manual.trigger' || s === 'manual') return 'Manual Trigger';
  if (s === 'webhook.trigger' || s === 'webhook') return 'Webhook Trigger';
  if (s === 'schedule.trigger' || s === 'schedule') return 'Schedule Trigger';
  if (s === 'http.request' || s === 'http') return 'HTTP Request';
  if (s === 'logic.if') return 'IF Condition';
  if (s === 'logic.merge') return 'Merge Branches';
  if (s === 'logic.delay') return 'Delay';

  return service;
}
