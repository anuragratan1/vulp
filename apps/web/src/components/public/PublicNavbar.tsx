import { ArrowRight, Github } from 'lucide-react';
import { VulpLogo } from '../VulpLogo.js';

interface PublicNavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenAuth: (tab: 'signin' | 'signup') => void;
}

export function PublicNavbar({ currentPath, onNavigate, onOpenAuth }: PublicNavbarProps) {
  const navLinks = [
    { label: 'Features', path: 'features' },
    { label: 'Integrations', path: 'integrations' },
    { label: 'Templates', path: 'templates' },
    { label: 'About', path: 'about' },
    { label: 'Contact', path: 'contact' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-surface/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-3 text-left focus:outline-none"
        >
          <VulpLogo size={32} />
          <div>
            <span className="font-bold text-base text-text-primary tracking-tight">VULP</span>
            <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold bg-[#FF7306]/10 text-[#FF7306] rounded-full border border-[#FF7306]/20">
              Edge Cloud
            </span>
          </div>
        </button>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => onNavigate(link.path)}
              className={`text-xs font-semibold transition-colors ${
                currentPath === link.path
                  ? 'text-[#FF7306]'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/anuragratan1/vulp"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            title="GitHub Repository"
          >
            <Github className="w-4 h-4" />
          </a>

          <button
            onClick={() => onOpenAuth('signin')}
            className="text-xs font-semibold px-4 py-2 rounded-xl text-text-secondary hover:text-text-primary transition-colors"
          >
            Sign In
          </button>

          <button
            onClick={() => onOpenAuth('signup')}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-[#FF7306] hover:bg-[#FF7306]/90 text-white shadow-md shadow-[#FF7306]/20 transition-all duration-150"
          >
            <span>Start Free</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
