import { ArrowLeft, FileText } from 'lucide-react';

interface TermsOfServicePageProps {
  onBack: () => void;
}

export function TermsOfServicePage({ onBack }: TermsOfServicePageProps) {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141414] border border-[#242424] text-xs font-mono text-[#FF7306]">
            <FileText className="w-3.5 h-3.5" />
            <span>Platform Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-[#71717A] font-mono">
            Effective Date: November 9, 2026 • Version 1.0 (Production)
          </p>
        </div>

        {/* Terms Content */}
        <div className="space-y-10 text-xs sm:text-sm text-[#A1A1AA] leading-relaxed font-sans">
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the VULP platform ("VULP", "we", "us", or "the Service"), creating an account, or connecting any integration, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">2. User Accounts & Workspace Sovereignty</h2>
            <p>
              You must register an account to access private workspaces, visual canvas editing, and execution telemetry. You are responsible for:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-[#D4D4D8]">
              <li>Maintaining the confidentiality of your account credentials and bearer session tokens.</li>
              <li>All workflows, webhook executions, and third-party API operations dispatched under your workspaces.</li>
              <li>Ensuring that credentials and API keys stored in your vault have appropriate permissions.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">3. Acceptable Use Policy</h2>
            <p>You agree not to use VULP to:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-[#D4D4D8]">
              <li>Send unsolicited bulk emails (SPAM) or violate the CAN-SPAM Act via Gmail or SMTP nodes.</li>
              <li>Launch Denial of Service (DoS) attacks, flood third-party APIs, or abuse edge compute resources.</li>
              <li>Transmit malware, spyware, phishing payloads, or malicious executable content.</li>
              <li>Attempt to bypass multi-tenant isolation or access credentials belonging to other workspaces.</li>
              <li>Violate the terms of service of connected providers, including Google, Telegram, and Slack.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">4. Third-Party Integrations & API Terms</h2>
            <p>
              VULP facilitates connections to third-party services including Google Workspace, Telegram, and Slack. By authorizing these services, you acknowledge that your use of third-party platforms is subject to their respective terms:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[#D4D4D8]">
              <li>Google APIs: Subject to Google Terms of Service and Google API Services User Data Policy.</li>
              <li>Telegram API: Subject to Telegram Terms of Service.</li>
              <li>Slack API: Subject to Slack API Terms of Service.</li>
            </ul>
            <p>
              VULP is not responsible for outages, rate limits, or policy changes imposed by third-party providers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">5. Intellectual Property & Workflow Ownership</h2>
            <p>
              <strong>Your Workflows:</strong> You retain 100% intellectual property ownership over the DAG workflow graphs, expressions, business logic, and data configurations you create in VULP.
            </p>
            <p>
              <strong>The Platform:</strong> The VULP platform source code is made available as open-source software under the MIT License on GitHub.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">6. Disclaimers & Limitation of Liability</h2>
            <p>
              VULP is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind. To the fullest extent permitted by law, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.
            </p>
            <p>
              In no event shall VULP, its creators, or contributors be liable for any indirect, incidental, punitive, or consequential damages arising out of your use of the platform, third-party API failures, or loss of data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">7. Termination</h2>
            <p>
              You may terminate your account at any time by deleting your workspaces or requesting account removal. We reserve the right to suspend or terminate accounts that violate our Acceptable Use Policy or engage in abusive automated traffic.
            </p>
          </section>

          <section className="space-y-3 border-t border-[#202020] pt-6">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">8. Contact & Legal Inquiries</h2>
            <p>For questions regarding these Terms of Service, contact:</p>
            <div className="p-4 rounded-xl bg-[#121212] border border-[#222222] font-mono text-xs text-[#D4D4D8]">
              <div>Email: <a href="mailto:anuragratan321@gmail.com" className="text-[#FF7306] hover:underline">anuragratan321@gmail.com</a></div>
              <div>Platform: VULP Visual Workflow Automation Platform</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
