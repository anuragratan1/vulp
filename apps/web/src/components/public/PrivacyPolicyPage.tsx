import { ShieldCheck, ArrowLeft } from 'lucide-react';

interface LegalPageProps {
  onBack: () => void;
}

export function PrivacyPolicyPage({ onBack }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background text-text-primary py-12 px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="space-y-3 pb-6 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            GDPR & Google API User Data Policy Compliant
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="text-xs text-text-secondary">
            Last Updated: November 9, 2026 • Effective Date: November 9, 2026
          </p>
        </div>

        <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-6 text-text-secondary">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">1. Overview & Commitment</h2>
            <p>
              VULP ("we", "our", or "platform") provides visual workflow automation infrastructure enabling
              users to design, orchestrate, and execute autonomous data pipelines across disparate services.
              We take privacy and tenant isolation seriously: your workflow configurations, execution logs,
              and third-party credentials belong solely to you.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">2. Google API Services User Data Policy Compliance</h2>
            <p className="bg-surface-elevated/40 p-4 rounded-xl border border-border text-text-primary">
              <strong>Google Limited Use Disclosure:</strong> VULP's use and transfer of information received from
              Google APIs to any other app will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="text-[#FF7306] hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Scope Minimization:</strong> When you authorize Google Workspace, VULP requests only the
                explicit scopes required to execute your configured workflow steps (e.g., sending emails via Gmail,
                reading and appending rows to Google Sheets, uploading files to Google Drive, retrieving responses from Google Forms,
                or scheduling Google Calendar events).
              </li>
              <li>
                <strong>No Advertising Use:</strong> We never use your Google user data, email contents, or spreadsheet data
                for serving advertisements, retargeting, data brokering, or training generalized artificial intelligence or machine learning models.
              </li>
              <li>
                <strong>Zero Human Review:</strong> Platform engineers and personnel do not read or inspect your private Google data
                unless explicitly requested by you for targeted troubleshooting or as required by binding legal process.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">3. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Account Credentials:</strong> Name, email address, and cryptographically salted password hashes (PBKDF2-SHA512).
                Plaintext passwords are never stored or transmitted.
              </li>
              <li>
                <strong>Encrypted Third-Party Credentials:</strong> API tokens, OAuth refresh tokens, and bot tokens needed
                to authenticate operations on your behalf. All credentials are encrypted at rest using AES-256-GCM.
              </li>
              <li>
                <strong>Workflow Graphs & Snapshots:</strong> Node connections, parameters, triggers, and execution state trees
                authored within your tenant workspace.
              </li>
              <li>
                <strong>Execution Telemetry:</strong> Step execution status, timestamps, output payloads, and step log entries
                strictly stored in your workspace history.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">4. Zero-Leak Multi-Tenant Architecture</h2>
            <p>
              VULP enforces strict server-side tenant isolation. Every database table (including workflows, credentials,
              and execution records) contains a foreign key to an authenticated workspace. Ownership checks are verified
              at the API routing layer before database queries are processed. A user from one tenant workspace cannot
              discover, query, modify, or execute records from another workspace.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">5. Data Retention & Account Deletion Rights</h2>
            <p>
              Under global data privacy laws including the European Union General Data Protection Regulation (GDPR) and
              the California Consumer Privacy Act (CCPA), you retain complete sovereignty over your data:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Immediate Revocation:</strong> You can disconnect and revoke third-party credentials (including Google OAuth tokens)
                at any time via the Connections dashboard.
              </li>
              <li>
                <strong>Full Self-Serve Deletion:</strong> You can delete individual workflows, executions, or your entire account
                via Account Settings &gt; Danger Zone. Triggering account deletion cascades through the database, permanently purging
                all user records, workspaces, workflows, encrypted tokens, and logs.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">6. Contact & Data Protection Officer</h2>
            <p>
              If you have inquiries regarding our data handling practices or wish to submit a privacy request, please contact
              our team at <span className="text-text-primary font-mono">privacy@vulp.dev</span> or visit our GitHub project repository.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
