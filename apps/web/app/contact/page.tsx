"use client";

import { useState } from "react";

type ContactType = "builder" | "user" | "collab" | "partnership";

const TYPES: { id: ContactType; label: string; description: string; icon: string }[] = [
  { id: "builder", label: "Builder", description: "I want to list my AI agent", icon: "🔌" },
  { id: "user", label: "User", description: "I have feedback or a question", icon: "👤" },
  { id: "collab", label: "Collaboration", description: "Let's build something together", icon: "🤝" },
  { id: "partnership", label: "Partnership", description: "Business or strategic opportunity", icon: "🏢" },
];

const PLACEHOLDERS: Record<ContactType, string> = {
  builder: "Tell us about your agent — what it does, your endpoint URL, and any questions about the registration process.",
  user: "What's on your mind? Feedback, bug reports, and feature requests are all welcome.",
  collab: "Describe your idea or project and how you'd like to collaborate.",
  partnership: "Tell us about your company and the opportunity you have in mind.",
};

export default function ContactPage() {
  const [type, setType] = useState<ContactType>("builder");
  const [result, setResult] = useState<"idle" | "sending" | "success" | "error">("idle");

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult("sending");
    const formData = new FormData(event.currentTarget);
    formData.append("access_key", "22d822e9-2037-432f-b8c4-5269a8486c57");
    formData.append("subject", `sources.eth — ${TYPES.find((t) => t.id === type)?.label} inquiry`);

    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (data.success) {
      setResult("success");
      (event.target as HTMLFormElement).reset();
      setType("builder");
    } else {
      setResult("error");
    }
  };

  const inputClass =
    "w-full px-4 py-3 bg-[#16161f] border border-white/[0.07] rounded-lg text-white placeholder-white/25 font-display focus:outline-none focus:border-[#7c6aff]/50 focus:ring-1 focus:ring-[#7c6aff]/30 transition-all";

  return (
    <div className="px-4 sm:px-7 py-16">
      <div className="max-w-2xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-white/40">get in touch</div>
          <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Builder, partner,<br />
            <span className="text-[#7c6aff] italic font-medium">or just curious?</span>
          </h1>
          <p className="mt-5 mx-auto max-w-md text-base text-white/55 leading-relaxed">
            We read every message. Tell us what you're working on, what's broken, or what we should build next.
          </p>
        </div>

        {/* Type selector */}
        <div className="mb-8">
          <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-white/40 mb-3">what are you reaching out about</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  type === t.id
                    ? "bg-[#7c6aff]/10 border-[#7c6aff]/40 text-white shadow-[0_0_30px_rgba(124,106,255,0.15)]"
                    : "bg-[#16161f] border-white/[0.07] text-white/55 hover:text-white hover:border-white/20"
                }`}
              >
                <div className="text-xl mb-1.5">{t.icon}</div>
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-white/35 mt-0.5 leading-tight">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={onSubmit}
          className="bg-[#16161f] border border-white/[0.07] rounded-2xl p-6 sm:p-7 space-y-4"
        >
          <input type="hidden" name="type" value={type} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-1.5">Name</label>
              <input type="text" name="name" required placeholder="Your name" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-1.5">Email</label>
              <input type="email" name="email" required placeholder="you@example.com" className={inputClass} />
            </div>
          </div>

          {(type === "builder" || type === "partnership") && (
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-1.5">
                {type === "builder" ? "Agent / project name" : "Company / organization"}
              </label>
              <input
                type="text"
                name="organization"
                placeholder={type === "builder" ? "My Agent Name" : "Acme Corp"}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-1.5">Message</label>
            <textarea
              name="message"
              required
              rows={5}
              placeholder={PLACEHOLDERS[type]}
              className={inputClass + " resize-none"}
            />
          </div>

          {result === "error" && (
            <p className="text-red-400 text-sm">Something went wrong — please try again.</p>
          )}

          {result === "success" ? (
            <div className="w-full py-4 bg-[#4fd8b8]/10 border border-[#4fd8b8]/20 rounded-xl text-center text-[#4fd8b8] font-medium">
              Message sent! We&apos;ll get back to you soon.
            </div>
          ) : (
            <button
              type="submit"
              disabled={result === "sending"}
              className="w-full py-3 bg-[#7c6aff] hover:bg-[#6b59ee] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all shadow-[0_12px_30px_-12px_rgba(124,106,255,0.5)]"
            >
              {result === "sending" ? "Sending..." : "Send message →"}
            </button>
          )}
        </form>

        <p className="text-center text-xs text-white/30 mt-6">
          Or DM <a href="https://twitter.com/ensgianteth" target="_blank" rel="noreferrer" className="text-[#7c6aff] hover:text-[#9a8cff]">@ensgianteth</a> on X.
        </p>
      </div>
    </div>
  );
}
