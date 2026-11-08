import { ArrowLeft, Cookie } from 'lucide-react';

interface LegalPageProps {
  onBack: () => void;
}

export function CookiePolicyPage({ onBack }: LegalPageProps) {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-[#FF7306] border border-[#FF7306]/20 text-xs font-semibold">
            <Cookie className="w-3.5 h-3.5" />
            Cookie & Local Storage Disclosure
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Cookie Policy</h1>
          <p className="text-xs text-text-secondary">
            Last Updated: November 9, 2026 • Effective Date: November 9, 2026
          </p>
        </div>

        <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-6 text-text-secondary">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">1. Zero Third-Party Advertising Cookies</h2>
            <p>
              VULP is committed to clean, privacy-respecting software. We do not use third-party advertising cookies,
              cross-site tracking pixels, fingerprinting scripts, or commercial remarketing beacons.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">2. Strictly Necessary Storage</h2>
            <p>
              We use local browser storage and session cookies exclusively for necessary platform operations:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-border">
                <thead>
                  <tr className="bg-surface-elevated/50 text-text-primary">
                    <th className="p-2.5 border border-border">Key / Name</th>
                    <th className="p-2.5 border border-border">Purpose</th>
                    <th className="p-2.5 border border-border">Lifespan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2.5 border border-border font-mono text-[11px]">vulp_auth_token</td>
                    <td className="p-2.5 border border-border">Maintains secure authenticated session token</td>
                    <td className="p-2.5 border border-border">30 days / until sign out</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border border-border font-mono text-[11px]">vulp_active_workspace</td>
                    <td className="p-2.5 border border-border">Stores user workspace preference</td>
                    <td className="p-2.5 border border-border">Persistent</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border border-border font-mono text-[11px]">theme</td>
                    <td className="p-2.5 border border-border">UI theme preference (dark / light / obsidian)</td>
                    <td className="p-2.5 border border-border">Persistent</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">3. Managing Local Storage</h2>
            <p>
              You can clear your local storage at any time using your browser's developer tools or settings menu.
              Logging out of VULP immediately purges your active authentication token from your device.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
