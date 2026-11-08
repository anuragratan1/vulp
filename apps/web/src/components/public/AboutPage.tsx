import { ArrowLeft, Code2, Globe, Shield, Github } from 'lucide-react';
import { VulpLogo } from '../VulpLogo.js';

interface AboutPageProps {
  onBack: () => void;
}

export function AboutPage({ onBack }: AboutPageProps) {
  return (
    <div className="min-h-screen bg-background text-text-primary py-12 px-6">
      <div className="max-w-4xl mx-auto space-y-12">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <VulpLogo size={40} />
            <h1 className="text-3xl font-extrabold tracking-tight">About VULP</h1>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            The next-generation autonomous visual workflow automation engine built on modern edge infrastructure.
          </p>
        </div>

        <div className="space-y-6 text-xs text-text-secondary leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">Our Vision</h2>
            <p>
              Traditional automation tools are often bloated, suffer from painful cold starts, impose artificial lock-in,
              or fail to provide true tenant-level cryptographic isolation. VULP was created as an open, high-velocity alternative:
              a platform that combines the fluidity of a visual canvas with the raw speed of global serverless edge execution.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">Core Architectural Pillars</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-border bg-surface-elevated/40 space-y-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <h3 className="text-xs font-bold text-text-primary">Cloudflare Edge + D1</h3>
                <p className="text-[11px] text-text-secondary">
                  Stateless workers and low-latency edge SQLite storage guarantee instant execution with zero server maintenance.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-surface-elevated/40 space-y-2">
                <Shield className="w-5 h-5 text-green-400" />
                <h3 className="text-xs font-bold text-text-primary">Zero-Leak Cryptography</h3>
                <p className="text-[11px] text-text-secondary">
                  AES-256-GCM authenticated encryption ensures third-party tokens are inaccessible across tenant boundaries.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-surface-elevated/40 space-y-2">
                <Code2 className="w-5 h-5 text-[#FF7306]" />
                <h3 className="text-xs font-bold text-text-primary">Deterministic DAG Engine</h3>
                <p className="text-[11px] text-text-secondary">
                  Topological sequencing, cycle prevention, and immutable run snapshots provide predictable execution semantics.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text-primary">Open Source & Community</h2>
            <p>
              VULP is proud to be open-source software under the permissive MIT license. Developers and engineers
              can inspect every line of the execution engine, contribute node adapters, or run their own private clusters.
            </p>
            <div className="pt-2">
              <a
                href="https://github.com/anuragratan1/vulp"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-xs font-semibold text-text-primary hover:bg-surface-hover transition-colors"
              >
                <Github className="w-4 h-4" /> View GitHub Repository
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
