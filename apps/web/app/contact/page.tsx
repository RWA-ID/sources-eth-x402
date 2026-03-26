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
    formData.append("subject", `sources.eth — ${TYPES.find(t => t.id === type)?.label} inquiry`);

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

  const inputClass = "w-full px-4 py-3 bg-[#111118] border border-white/[0.07] rounded-lg text-white placeholder-white/25 font-display focus:outline-none focus:border-[#7c6aff]/50 focus:ring-1 focus:ring-[#7c6aff]/30 transition-all";

  return (
    <div className="px-4 py-16 max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <p className="text-white/40 text-sm font-medium uppercase tracking-widest mb-3">Builder, partner, or just curious?</p>
        <h1 className="text-3xl font-bold mb-3">Get in touch</h1>
        <p className="text-white/40 max-w-md mx-auto">
          Builders, users, collaborators, and partners — we want to hear from you.
        </p>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={`p-3 rounded-xl border text-left transition-all ${
              type === t.id
                ? "bg-[#7c6aff]/10 border-[#7c6aff]/40 text-white"
                : "bg-[#16161f] border-white/[0.07] text-white/50 hover:text-white hover:border-white/20"
            }`}
          >
            <div className="text-xl mb-1">{t.icon}</div>
            <div className="text-sm font-medium">{t.label}</div>
            <div className="text-xs text-white/30 mt-0.5 leading-tight">{t.description}</div>
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="type" value={type} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/50 mb-1.5">Name</label>
            <input
              type="text"
              name="name"
              required
              placeholder="Your name"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1.5">Email</label>
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>
        </div>

        {(type === "builder" || type === "partnership") && (
          <div>
            <label className="block text-sm text-white/50 mb-1.5">
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
          <label className="block text-sm text-white/50 mb-1.5">Message</label>
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
            className="w-full py-3 bg-[#7c6aff] hover:bg-[#6b59ee] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all"
          >
            {result === "sending" ? "Sending..." : "Send message"}
          </button>
        )}
      </form>
    </div>
  );
}
