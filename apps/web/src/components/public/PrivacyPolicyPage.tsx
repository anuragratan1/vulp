import { ArrowLeft, ShieldCheck, Lock, ExternalLink } from 'lucide-react';

interface PrivacyPolicyPageProps {
  onBack: () => void;
}

export function PrivacyPolicyPage({ onBack }: PrivacyPolicyPageProps) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F5] pt-24 pb-20 selection:bg-[#FF7306]/20 selection:text-[#FF7306]">
      <div className="max-w-4xl mx-auto px-6 space-y-12">
        {/* Navigation Breadcrumb */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#A1A1AA] hover:text-[#FF7306] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        {/* Title & Metadata */}
        <div className="space-y-4 border-b border-[#202020] pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141414] border border-[#242424] text-xs font-mono text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy & Data Sovereignty</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-[#71717A] font-mono">
            Effective Date: November 9, 2026 • Version 1.0 (Production)
          </p>
        </div>

        {/* Policy Body */}
        <div className="space-y-10 text-xs sm:text-sm text-[#A1A1AA] leading-relaxed font-sans">
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">1. Overview & Commitment</h2>
            <p>
              VULP ("we", "us", or "the Platform") is an open-source visual DAG workflow automation platform engineered on Cloudflare Workers and Cloudflare D1 distributed database. We are committed to protecting your privacy and practicing strict data minimization.
            </p>
            <p>
              This Privacy Policy explains what information is collected, how it is processed and secured, how third-party integrations (specifically Google APIs, Telegram, and Slack) are handled, and how you retain complete sovereignty over your data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">2. Information We Collect</h2>
            <p>We collect only the minimum necessary data to provide and secure the automation services you configure:</p>
            <ul className="list-disc pl-5 space-y-2 text-[#D4D4D8]">
              <li>
                <strong>Account Credentials:</strong> When you register via email and password, we store your name, email address, and a cryptographically salted and hashed representation of your password (using Web Crypto PBKDF2 with SHA-256). We never store plaintext passwords.
              </li>
              <li>
                <strong>Google Identity Data:</strong> When signing in with Google, we verify your Google ID token server-side and store your Google Subject ID (<code className="text-[#FF7306] font-mono">sub</code>), verified email address, full name, and avatar URL.
              </li>
              <li>
                <strong>Workflow Definitions:</strong> Visual node graphs, step parameters, connection edges, schedule crons, and webhook configurations you create in your workspace.
              </li>
              <li>
                <strong>Encrypted Third-Party Credentials:</strong> API keys, Telegram bot tokens, Slack webhook URLs, and Google OAuth tokens (access and refresh tokens) that you explicitly provide to execute actions.
              </li>
              <li>
                <strong>Execution Logs:</strong> Timestamps, execution status (success/failed), step durations in milliseconds, and input/output payload summaries for workflow runs initiated by your triggers.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <div className="p-6 rounded-2xl bg-[#121212] border border-[#242424] space-y-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>3. Google API Services User Data Policy Compliance</span>
              </h2>
              <p className="text-xs text-[#D4D4D8] leading-relaxed">
                VULP's use and transfer to any other app of information received from Google APIs adheres to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FF7306] hover:underline inline-flex items-center gap-1"
                >
                  <span>Google API Services User Data Policy</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                , including the Limited Use requirements. Specifically:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#A1A1AA]">
                <li>
                  <strong>Limited Use Principle:</strong> Google data (such as emails sent via Gmail API, rows appended to Google Sheets, or files uploaded to Google Drive) is read and written strictly in real-time to execute the specific workflow steps you author.
                </li>
                <li>
                  <strong>No Human Surveillance:</strong> No employee, developer, or contractor at VULP inspects your private emails, spreadsheet rows, calendar schedules, or form submissions unless you explicitly share diagnostic logs for customer support.
                </li>
                <li>
                  <strong>No Advertising or Transfer:</strong> We never sell, transfer, disclose, or use Google user data for advertising, remarketing, or broker data sales.
                </li>
                <li>
                  <strong>No AI Model Training:</strong> Your Google data is never used to train, refine, or evaluate generalized artificial intelligence or machine learning models.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">4. Storage & Encryption Architecture</h2>
            <p>
              Security is implemented at the database and memory layer:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[#D4D4D8]">
              <li>
                <strong>AES-256-GCM Encryption:</strong> All sensitive credentials and OAuth tokens are encrypted using 256-bit Advanced Encryption Standard in Galois/Counter Mode (AES-GCM) with unique 96-bit initialization vectors. Plaintext secrets are never written to disk or logs.
              </li>
              <li>
                <strong>Tenant Boundary Enforcement:</strong> Every database query in Cloudflare D1 strictly enforces ownership by validating the authenticated workspace ID against the cryptographically issued bearer token. Users cannot query or mutate data belonging to other tenants.
              </li>
              <li>
                <strong>Stateless Edge Execution:</strong> Node executions run within sandboxed Cloudflare Workers V8 isolates and terminate immediately upon return.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">5. Third-Party Service Providers</h2>
            <p>We utilize trusted cloud infrastructure to host and execute the platform:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-[#D4D4D8]">
              <li><strong>Cloudflare, Inc.:</strong> Global Edge compute (Workers), D1 distributed database, and DDoS protection.</li>
              <li><strong>Vercel, Inc.:</strong> Frontend application static hosting and CDN delivery.</li>
              <li><strong>Google LLC:</strong> Google Identity Services and Google Workspace APIs (Gmail, Sheets, Drive, Calendar, Forms).</li>
              <li><strong>Telegram / Slack:</strong> Direct API endpoints for message dispatch configured by you.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">6. Your Rights & Data Deletion</h2>
            <p>You maintain complete control over your account and integrations:</p>
            <ul className="list-disc pl-5 space-y-2 text-[#D4D4D8]">
              <li>
                <strong>Disconnecting Integrations:</strong> You can disconnect any integration at any time from the Connections tab. This immediately revokes OAuth tokens and permanently purges the credential record from our database.
              </li>
              <li>
                <strong>Account Deletion:</strong> You may request permanent deletion of your account and workspaces by contacting support or initiating deletion from settings. All workflows, execution logs, and credentials are permanently purged.
              </li>
              <li>
                <strong>Exporting Data:</strong> You can export your visual DAG workflow definitions as standard JSON files at any time.
              </li>
            </ul>
          </section>

          <section className="space-y-3 border-t border-[#202020] pt-6">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">7. Contact Information</h2>
            <p>
              For privacy inquiries, data deletion requests, or security disclosures, contact the platform maintainer directly:
            </p>
            <div className="p-4 rounded-xl bg-[#121212] border border-[#222222] space-y-1 font-mono text-xs">
              <div>Email: <a href="mailto:anuragratan321@gmail.com" className="text-[#FF7306] hover:underline">anuragratan321@gmail.com</a></div>
              <div>GitHub Issues: <a href="https://github.com/anuragratan1/vulp/issues" target="_blank" rel="noopener noreferrer" className="text-[#FF7306] hover:underline">https://github.com/anuragratan1/vulp/issues</a></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
