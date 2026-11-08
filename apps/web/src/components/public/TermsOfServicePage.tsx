import { ArrowLeft, FileText } from 'lucide-react';

interface LegalPageProps {
  onBack: () => void;
}

export function TermsOfServicePage({ onBack }: LegalPageProps) {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold">
            <FileText className="w-3.5 h-3.5" />
            Terms of Service & Acceptable Use
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Terms of Service</h1>
          <p className="text-xs text-text-secondary">
            Last Updated: November 9, 2026 • Effective Date: November 9, 2026
          </p>
        </div>

        <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-6 text-text-secondary">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">1. Agreement to Terms</h2>
            <p>
              By accessing or creating an account on VULP ("the Service"), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, do not access or use the Service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">2. Service Description & Availability</h2>
            <p>
              VULP is a visual workflow orchestration platform executed across distributed edge worker nodes.
              While we strive for 99.9% uptime, the Service is provided "as is" and "as available". We reserve
              the right to modify, suspend, or discontinue any feature with reasonable notice where feasible.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">3. Acceptable Use Policy</h2>
            <p>You agree not to use VULP to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Transmit unsolicited bulk emails, spam, phishing lures, or deceptive messages via Gmail or any other connected integration.</li>
              <li>Exceed authorized API rate limits or deliberately cause denial-of-service disruptions against third-party endpoints.</li>
              <li>Engage in illegal activities, surveillance, malware distribution, or intellectual property infringement.</li>
              <li>Attempt to reverse-engineer, exploit vulnerabilities, or breach the tenant isolation boundaries of the platform.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">4. Webhook Ingestion & Rate Limits</h2>
            <p>
              Workflows triggered via incoming webhooks must adhere to fair-use rate limits (up to 120 requests per minute
              on standard tiers). Ingestion endpoints receiving abusive traffic patterns may be temporarily throttled to protect
              platform integrity.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">5. Intellectual Property & Ownership</h2>
            <p>
              You retain all ownership rights and intellectual property interests in your workflow designs, logic graphs,
              and data processed through the platform. VULP claims no proprietary interest in your automations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, VULP and its maintainers shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, or operational
              downtime arising from third-party API changes, network outages, or workflow misconfigurations.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
