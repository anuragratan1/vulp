import { Github, ShieldCheck, Terminal, CheckCircle2 } from 'lucide-react';
import { VulpLogo } from '../VulpLogo.js';

interface PublicFooterProps {
  onNavigate: (path: string) => void;
}

export function PublicFooter({ onNavigate }: PublicFooterProps) {
  const handleNav = (path: string) => {
    onNavigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full border-t border-[#1F1F1F] bg-[#0A0A0A] text-[#A1A1AA] text-xs font-sans">
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 pb-16 border-b border-[#1E1E1E]">
          {/* Brand & Architectural Overview */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <VulpLogo size={28} />
              <span className="font-extrabold text-base text-white tracking-tight">VULP</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#1A1A1A] text-[#FF7306] border border-[#2E2E2E]">
                v1.0.0-edge
              </span>
            </div>
            <p className="text-xs text-[#8E8E93] leading-relaxed max-w-sm">
              Visual Directed Acyclic Graph (DAG) orchestration platform powered by Cloudflare Workers and D1 database.
              Connect Google Workspace, Telegram, Slack, and webhooks with sub-millisecond dispatch and hardware-grade AES-256-GCM encryption.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#141414] border border-[#242424] text-[11px] text-[#D4D4D8]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Global Edge Network Operational</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#71717A]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Strict Tenant Boundary & AES-256 Isolation</span>
              </div>
            </div>
          </div>

          {/* Product Column */}
          <div className="space-y-3.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white">Platform</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={() => handleNav('features')} className="hover:text-white transition-colors text-left">
                  DAG Engine & Logic
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('integrations')} className="hover:text-white transition-colors text-left">
                  Integrations Directory
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('templates')} className="hover:text-white transition-colors text-left">
                  Workflow Blueprints
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('security')} className="hover:text-white transition-colors text-left">
                  Encrypted Vault
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('home')} className="hover:text-white transition-colors text-left">
                  Pricing & Free Tier
                </button>
              </li>
            </ul>
          </div>

          {/* Resources & Docs */}
          <div className="space-y-3.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white">Resources</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={() => handleNav('docs')} className="hover:text-white transition-colors text-left">
                  Documentation Hub
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('docs')} className="hover:text-white transition-colors text-left">
                  Quickstart Guide
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('faq')} className="hover:text-white transition-colors text-left">
                  Frequently Asked Questions
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('about')} className="hover:text-white transition-colors text-left">
                  System Architecture
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/anuragratan1/vulp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5 text-left"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub Repository</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div className="space-y-3.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white">Trust & Legal</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={() => handleNav('privacy')} className="hover:text-white transition-colors text-left">
                  Privacy Policy
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('terms')} className="hover:text-white transition-colors text-left">
                  Terms of Service
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('cookies')} className="hover:text-white transition-colors text-left">
                  Cookie Disclosure
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('security')} className="hover:text-white transition-colors text-left">
                  Security Whitepaper
                </button>
              </li>
              <li>
                <div className="text-[11px] text-[#71717A] leading-relaxed pt-1">
                  Google API Services User Data Policy Compliant
                </div>
              </li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div className="space-y-3.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white">Contact</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={() => handleNav('contact')} className="hover:text-white transition-colors text-left">
                  Help & Developer Support
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/anuragratan1/vulp/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors text-left"
                >
                  Report an Issue
                </a>
              </li>
              <li>
                <a
                  href="mailto:anuragratan321@gmail.com"
                  className="text-[#FF7306] hover:underline transition-all text-left"
                >
                  anuragratan321@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar with Tech Badges */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#71717A]">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} VULP Platform.</span>
            <span>•</span>
            <span>Open Source under MIT License.</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5 text-[#A1A1AA]" />
              <span>React Flow & TypeScript</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero-Cold-Start Edge</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
