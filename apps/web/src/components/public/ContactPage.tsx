import { useState } from 'react';
import { ArrowLeft, Mail, Send, CheckCircle2, Github } from 'lucide-react';

interface ContactPageProps {
  onBack: () => void;
}

export function ContactPage({ onBack }: ContactPageProps) {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background text-text-primary py-12 px-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight">Contact & Support</h1>
          <p className="text-xs text-text-secondary leading-relaxed">
            Have questions, feature requests, or integration feedback? We'd love to hear from you.
          </p>
        </div>

        {submitted ? (
          <div className="p-8 rounded-2xl border border-green-500/20 bg-green-500/10 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto" />
            <h3 className="text-base font-bold text-text-primary">Thank you for your message!</h3>
            <p className="text-xs text-text-secondary">
              Our engineering team has received your inquiry and will respond to{' '}
              <strong className="text-text-primary">{email}</strong> shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 rounded-2xl border border-border bg-surface-elevated/40 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Your Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-surface border border-border text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[#FF7306]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Message / Inquiry</label>
              <div className="relative">
                <textarea
                  required
                  rows={4}
                  placeholder="How can we help you automate your workflow?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-surface border border-border text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[#FF7306]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#FF7306] hover:bg-[#FF7306]/90 text-white font-semibold text-xs shadow-md transition-colors"
            >
              <Send className="w-3.5 h-3.5" /> Send Message
            </button>
          </form>
        )}

        <div className="p-6 rounded-2xl border border-border bg-surface flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-text-primary">Open Source Community</h4>
            <p className="text-[11px] text-text-secondary">
              Report bugs or request new integrations directly on GitHub.
            </p>
          </div>
          <a
            href="https://github.com/anuragratan1/vulp/issues"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-border text-text-primary transition-colors"
          >
            <Github className="w-3.5 h-3.5" /> Issues & Discussions
          </a>
        </div>
      </div>
    </div>
  );
}
