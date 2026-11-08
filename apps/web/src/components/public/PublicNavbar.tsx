import { useState, useEffect } from 'react';
import { ArrowRight, Github, Menu, X, BookOpen, Shield, Layers, Cpu, Sparkles, ExternalLink } from 'lucide-react';
import { VulpLogo } from '../VulpLogo.js';

interface PublicNavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenAuth: (tab: 'signin' | 'signup') => void;
}

export function PublicNavbar({ currentPath, onNavigate, onOpenAuth }: PublicNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Features', path: 'features', icon: Cpu },
    { label: 'Integrations', path: 'integrations', icon: Layers },
    { label: 'Templates', path: 'templates', icon: Sparkles },
    { label: 'Docs', path: 'docs', icon: BookOpen },
    { label: 'Security', path: 'security', icon: Shield },
  ];

  const handleLinkClick = (path: string) => {
    onNavigate(path);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-[#222222] shadow-2xl shadow-black/40 py-3'
          : 'bg-[#0A0A0A]/60 backdrop-blur-md border-b border-[#1A1A1A] py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-6 flex items-center justify-between">
        {/* Brand Logo & Edge Badge */}
        <button
          onClick={() => handleLinkClick('home')}
          className="flex items-center gap-3 text-left focus:outline-none group select-none"
          aria-label="VULP Homepage"
        >
          <div className="relative">
            <VulpLogo size={30} />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF7306] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF7306]" />
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white group-hover:text-[#FF7306] transition-colors">
                VULP
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-medium bg-[#1F1F1F] text-[#A1A1AA] border border-[#2A2A2A] rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Edge DAG
              </span>
            </div>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 bg-[#121212]/80 border border-[#222222] p-1 rounded-full shadow-inner">
          {navItems.map((item) => {
            const isActive = currentPath === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => handleLinkClick(item.path)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#1F1F1F] text-white shadow-sm font-semibold'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#181818]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#FF7306]' : 'text-[#71717A]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls & Auth */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://github.com/anuragratan1/vulp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#A1A1AA] hover:text-white bg-[#141414] hover:bg-[#1C1C1C] border border-[#242424] transition-colors"
            title="GitHub Repository"
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">GitHub</span>
          </a>

          <button
            onClick={() => onOpenAuth('signin')}
            className="text-xs font-semibold px-3.5 py-1.5 rounded-full text-[#A1A1AA] hover:text-white transition-colors"
          >
            Sign In
          </button>

          <button
            onClick={() => onOpenAuth('signup')}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-[#FF7306] hover:bg-[#FF8A29] text-white shadow-lg shadow-[#FF7306]/20 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Start Free</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => onOpenAuth('signup')}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[#FF7306] text-white"
          >
            Start Free
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-[#A1A1AA] hover:text-white bg-[#141414] border border-[#242424]"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#222222] bg-[#0E0E0E]/98 backdrop-blur-2xl px-6 py-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const isActive = currentPath === item.path;
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => handleLinkClick(item.path)}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#1F1F1F] text-[#FF7306]'
                      : 'text-[#D4D4D8] hover:bg-[#161616] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-[#FF7306]" />
                    <span>{item.label}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#52525B]" />
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#222222] flex flex-col gap-2.5">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAuth('signin');
              }}
              className="w-full py-2.5 rounded-xl border border-[#2A2A2A] text-sm font-semibold text-white bg-[#161616] hover:bg-[#202020] transition-colors"
            >
              Sign In to Workspace
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAuth('signup');
              }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#FF7306] hover:bg-[#FF8A29] shadow-lg shadow-[#FF7306]/20 transition-all"
            >
              Create Free Account
            </button>
            <a
              href="https://github.com/anuragratan1/vulp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2 text-xs text-[#71717A] hover:text-[#A1A1AA] transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>View Open Source Repository</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
