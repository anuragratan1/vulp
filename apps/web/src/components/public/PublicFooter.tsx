import { Github, ShieldCheck } from 'lucide-react';
import { VulpLogo } from '../VulpLogo.js';

interface PublicFooterProps {
  onNavigate: (path: string) => void;
}

export function PublicFooter({ onNavigate }: PublicFooterProps) {
  return (
    <footer className="w-full border-t border-border bg-surface-elevated/20 text-xs text-text-secondary">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand info */}
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <VulpLogo size={24} />
              <span className="font-bold text-sm text-text-primary tracking-tight">VULP</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed max-w-sm">
              Autonomous visual workflow automation platform built for speed and security.
              Deploy DAG pipelines on edge compute with zero-latency triggers and multi-tenant isolation.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-[11px] font-semibold border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                All Cloudflare Edge Systems Operational
              </span>
            </div>
          </div>

          {/* Product links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Product</h4>
            <ul className="space-y-2">
              <li>
                <button onClick={() => onNavigate('features')} className="hover:text-text-primary transition-colors">
                  Features & Engine
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('integrations')} className="hover:text-text-primary transition-colors">
                  Integrations Directory
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('templates')} className="hover:text-text-primary transition-colors">
                  Workflow Templates
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('home')} className="hover:text-text-primary transition-colors">
                  Pricing & Free Tier
                </button>
              </li>
            </ul>
          </div>

          {/* Company links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Project</h4>
            <ul className="space-y-2">
              <li>
                <button onClick={() => onNavigate('about')} className="hover:text-text-primary transition-colors">
                  About & Architecture
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('contact')} className="hover:text-text-primary transition-colors">
                  Contact & Support
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/anuragratan1/vulp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-text-primary transition-colors flex items-center gap-1"
                >
                  GitHub Source <Github className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Legal links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Legal & Security</h4>
            <ul className="space-y-2">
              <li>
                <button onClick={() => onNavigate('privacy')} className="hover:text-text-primary transition-colors">
                  Privacy Policy
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('terms')} className="hover:text-text-primary transition-colors">
                  Terms of Service
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('cookies')} className="hover:text-text-primary transition-colors">
                  Cookie Policy
                </button>
              </li>
              <li>
                <div className="flex items-center gap-1 text-[11px] text-text-tertiary pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                  <span>Google Limited Use Compliant</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-text-tertiary">
          <div>
            © {new Date().getFullYear()} VULP Platform. Open-source under MIT License.
          </div>
          <div className="flex items-center gap-1">
            <span>Engineered with precision for modern cloud automation</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
