import { ArrowLeft, Cookie } from 'lucide-react';

interface CookiePolicyPageProps {
  onBack: () => void;
}

export function CookiePolicyPage({ onBack }: CookiePolicyPageProps) {
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
            <Cookie className="w-3.5 h-3.5" />
            <span>Browser Storage Disclosure</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Cookie & Local Storage Policy
          </h1>
          <p className="text-xs sm:text-sm text-[#71717A] font-mono">
            Effective Date: November 9, 2026 • Version 1.0 (Production)
          </p>
        </div>

        {/* Content */}
        <div className="space-y-10 text-xs sm:text-sm text-[#A1A1AA] leading-relaxed font-sans">
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">1. How VULP Uses Browser Storage</h2>
            <p>
              VULP does not use tracking cookies, advertising pixels, or invasive third-party analytics cookies. We use only strictly necessary local storage mechanisms essential to maintain your authenticated session and UI workspace preferences.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">2. Inventory of Stored Items</h2>
            <div className="overflow-x-auto rounded-2xl border border-[#222222]">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#141414] text-white border-b border-[#222222] font-semibold">
                  <tr>
                    <th className="p-3.5">Storage Key</th>
                    <th className="p-3.5">Storage Mechanism</th>
                    <th className="p-3.5">Purpose</th>
                    <th className="p-3.5">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C1C1C] text-[#D4D4D8]">
                  <tr className="hover:bg-[#121212] transition-colors">
                    <td className="p-3.5 font-mono text-[#FF7306]">vulp_auth_token</td>
                    <td className="p-3.5 font-mono">localStorage</td>
                    <td className="p-3.5">Cryptographic bearer session token used to authenticate private API requests.</td>
                    <td className="p-3.5">Until sign out</td>
                  </tr>
                  <tr className="hover:bg-[#121212] transition-colors">
                    <td className="p-3.5 font-mono text-[#FF7306]">vulp_active_workflow_id</td>
                    <td className="p-3.5 font-mono">localStorage</td>
                    <td className="p-3.5">Stores the last active workflow ID in the visual studio canvas.</td>
                    <td className="p-3.5">Persistent</td>
                  </tr>
                  <tr className="hover:bg-[#121212] transition-colors">
                    <td className="p-3.5 font-mono text-[#FF7306]">vulp_sidebar_collapsed</td>
                    <td className="p-3.5 font-mono">localStorage</td>
                    <td className="p-3.5">Stores the user UI preference for the navigation sidebar state.</td>
                    <td className="p-3.5">Persistent</td>
                  </tr>
                  <tr className="hover:bg-[#121212] transition-colors">
                    <td className="p-3.5 font-mono text-[#FF7306]">vulp_redirect_after_auth</td>
                    <td className="p-3.5 font-mono">sessionStorage</td>
                    <td className="p-3.5">Temporarily preserves requested protected URL during authentication.</td>
                    <td className="p-3.5">Single session</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">3. Managing and Clearing Storage</h2>
            <p>
              When you click <strong>Sign Out</strong> in the VULP dashboard, your session token is automatically destroyed on the server and cleared from your browser's local storage.
            </p>
            <p>
              You can also clear all stored data at any time through your browser's privacy settings. Note that clearing local storage will require you to log in again to access your workspaces.
            </p>
          </section>

          <section className="space-y-3 border-t border-[#202020] pt-6">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">4. Contact Information</h2>
            <p>For questions regarding our storage practices, contact:</p>
            <div className="p-4 rounded-xl bg-[#121212] border border-[#222222] font-mono text-xs text-[#D4D4D8]">
              <div>Email: <a href="mailto:anuragratan321@gmail.com" className="text-[#FF7306] hover:underline">anuragratan321@gmail.com</a></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
