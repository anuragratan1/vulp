import { useState } from 'react';
import { ArrowLeft, Mail, Github, Send, CheckCircle2, Clock } from 'lucide-react';

interface ContactPageProps {
  onBack: () => void;
  onOpenAuth?: (tab: 'signin' | 'signup') => void;
}

export function ContactPage({ onBack }: ContactPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !message) return;
    // Direct mailto fallback / submission confirmation
    const mailto = `mailto:anuragratan321@gmail.com?subject=${encodeURIComponent(
      `[VULP Inquiry] ${subject || 'Support'}`
    )}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`)}`;
    window.location.href = mailto;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F5] pt-24 pb-20 selection:bg-[#FF7306]/20 selection:text-[#FF7306]">
      <div className="max-w-4xl mx-auto px-6 space-y-16">
        {/* Navigation Breadcrumb */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#A1A1AA] hover:text-[#FF7306] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        {/* Header Hero */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141414] border border-[#242424] text-xs font-mono text-[#FF7306]">
            <Mail className="w-3.5 h-3.5" />
            <span>Developer Support & Contact</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
            We're here to help you <span className="text-[#FF7306]">build & scale</span>.
          </h1>

          <p className="text-base text-[#A1A1AA] leading-relaxed max-w-2xl">
            Have questions about edge deployment, custom integration requests, or encounter a bug? Connect directly with the developer and engineering contributors.
          </p>
        </div>

        {/* Contact Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a
            href="mailto:anuragratan321@gmail.com"
            className="p-6 rounded-3xl bg-[#121212] border border-[#202020] hover:border-[#333333] transition-all space-y-3 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-[#1C1C1C] flex items-center justify-center text-[#FF7306] group-hover:scale-105 transition-transform">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">Direct Email</h3>
            <p className="text-xs text-[#8E8E93] leading-relaxed">
              Reach out directly to the maintainer for architectural questions or private disclosures.
            </p>
            <span className="text-xs font-mono text-[#FF7306] block pt-1">anuragratan321@gmail.com</span>
          </a>

          <a
            href="https://github.com/anuragratan1/vulp/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-3xl bg-[#121212] border border-[#202020] hover:border-[#333333] transition-all space-y-3 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-[#1C1C1C] flex items-center justify-center text-[#FF7306] group-hover:scale-105 transition-transform">
              <Github className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">GitHub Issues</h3>
            <p className="text-xs text-[#8E8E93] leading-relaxed">
              Report bugs, submit reproducible test cases, or track active development commits.
            </p>
            <span className="text-xs font-mono text-[#FF7306] block pt-1">github.com/anuragratan1/vulp</span>
          </a>

          <div className="p-6 rounded-3xl bg-[#121212] border border-[#202020] space-y-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-[#1C1C1C] flex items-center justify-center text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">Response Time</h3>
            <p className="text-xs text-[#8E8E93] leading-relaxed">
              We review issues and emails daily. Typical response turnaround is within 24–48 hours.
            </p>
            <span className="text-xs font-mono text-emerald-400 block pt-1">24–48hr turnaround</span>
          </div>
        </div>

        {/* Direct Contact Form */}
        <div className="p-8 sm:p-10 rounded-3xl bg-[#121212] border border-[#222222] space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white tracking-tight">Send a Message</h2>
            <p className="text-xs text-[#8E8E93]">Fill in your details below to open a pre-filled message draft to our team.</p>
          </div>

          {submitted ? (
            <div className="p-6 rounded-2xl bg-[#141A14] border border-emerald-500/30 text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">Draft Dispatched to Your Mail Client</h3>
              <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto">
                Your email client was opened with the message draft. If your mail client did not open automatically, please send your email directly to{' '}
                <strong className="text-white">anuragratan321@gmail.com</strong>.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#222222] text-white hover:bg-[#333333] transition-colors"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#D4D4D8]">Your Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Miller"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0C0C0C] border border-[#242424] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#FF7306] transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#D4D4D8]">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="alex@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0C0C0C] border border-[#242424] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#FF7306] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#D4D4D8]">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Google Sheets integration question"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0C0C0C] border border-[#242424] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#FF7306] transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#D4D4D8]">Message</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your question, workflow requirements, or issue in detail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0C0C0C] border border-[#242424] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#FF7306] transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#FF7306] hover:bg-[#FF8A29] text-white font-semibold text-xs shadow-lg shadow-[#FF7306]/20 transition-all hover:scale-[1.02]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Message</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
