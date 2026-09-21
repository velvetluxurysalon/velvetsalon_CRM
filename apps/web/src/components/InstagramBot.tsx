import React, { useEffect, useRef, useState } from 'react';

// ─── Config ───────────────────────────────────────────────────────────────────
const INSTAGRAM_USERNAME = 'velvet_premium_unisex_salon'; // update to your actual handle
const SALON_NAME = 'Velvet Premium Unisex Salon';

interface QuickOption {
  id: string;
  label: string;
}

const QUICK_OPTIONS: QuickOption[] = [
  { id: 'book', label: '📅 Book an appointment' },
  { id: 'services', label: '💇 Ask about services & pricing' },
  { id: 'membership', label: '⭐ Membership plans' },
  { id: 'location', label: '📍 Location & timings' },
  { id: 'other', label: '💬 Something else' },
];

interface ChatMessage {
  id: string;
  from: 'bot' | 'user';
  text: string;
}

const INSTAGRAM_PROFILE_LINK = `https://instagram.com/${INSTAGRAM_USERNAME}`;
// Deep link that opens the DM composer directly in the Instagram app (falls
// back to the profile page in a normal browser tab).
const INSTAGRAM_DM_LINK = `https://ig.me/m/${INSTAGRAM_USERNAME}`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function InstagramBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'greet',
      from: 'bot',
      text: `Hi there! 👋 I'm the ${SALON_NAME} Instagram assistant. How can I help you today?`,
    },
  ]);
  const [customText, setCustomText] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (open && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  const handleQuickOption = (opt: QuickOption) => {
    setMessages((prev) => [
      ...prev,
      { id: `${opt.id}-u-${String(Date.now())}`, from: 'user', text: opt.label },
      {
        id: `${opt.id}-b-${String(Date.now())}`,
        from: 'bot',
        text: `Great, let's continue this on Instagram so our team can help you right away.`,
      },
    ]);
    window.open(INSTAGRAM_DM_LINK, '_blank', 'noopener,noreferrer');
  };

  const handleCustomSend = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = customText.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { id: `custom-u-${String(Date.now())}`, from: 'user', text: trimmed },
      {
        id: `custom-b-${String(Date.now())}`,
        from: 'bot',
        text: `Thanks! Continuing this on Instagram so we can reply faster.`,
      },
    ]);
    window.open(INSTAGRAM_DM_LINK, '_blank', 'noopener,noreferrer');
    setCustomText('');
  };

  return (
    <div className="fixed bottom-40 right-4 sm:bottom-24 sm:right-5 z-50 font-['Jost']">
      {/* ── Chat panel ── */}
      {open && (
        <div
          ref={panelRef}
          className="mb-3 w-[92vw] max-w-[340px] bg-white border border-[#ede5d6] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ height: 460 }}
        >
          {/* Header */}
          <div
            className="px-4 py-3.5 flex items-center gap-3"
            style={{
              background:
                'linear-gradient(135deg,#feda75 0%,#fa7e1e 25%,#d62976 50%,#962fbf 75%,#4f5bd5 100%)',
            }}
          >
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.163 6.163 0 1 0 0 12.326 6.163 6.163 0 0 0 0-12.326zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white leading-tight truncate">
                {SALON_NAME}
              </p>
              <p className="text-[11px] text-white/70">Message us on Instagram</p>
            </div>
            <button
              onClick={() => {
                setOpen(false);
              }}
              aria-label="Close chat"
              className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div
            ref={bodyRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#faf8f4]"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    m.from === 'user'
                      ? 'bg-[#1a1208] text-[#d4af37] rounded-br-sm'
                      : 'bg-white border border-[#ede5d6] text-[#2c1f0e] rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {/* Quick options */}
            <div className="flex flex-col gap-2 pt-1">
              {QUICK_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    handleQuickOption(opt);
                  }}
                  className="text-left px-3.5 py-2.5 rounded-xl border border-[#e0d5c0] bg-white text-[13px] text-[#2c1f0e] hover:border-[#d62976] hover:bg-[#fff5f9] transition-all"
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <a
              href={INSTAGRAM_PROFILE_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-[11px] text-[#8a7560] hover:text-[#d62976] transition-colors pt-1"
            >
              or visit @{INSTAGRAM_USERNAME} →
            </a>
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              handleCustomSend(e);
            }}
            className="border-t border-[#ede5d6] p-2.5 flex items-center gap-2 bg-white"
          >
            <input
              type="text"
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value);
              }}
              placeholder="Type your message…"
              className="flex-1 h-10 border border-[#e0d5c0] rounded-full bg-[#faf8f4] px-4 text-[13px] text-[#2c1f0e] outline-none focus:border-[#d62976] transition-colors placeholder:text-[#c5b89a]"
            />
            <button
              type="submit"
              disabled={!customText.trim()}
              aria-label="Send message"
              className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex-shrink-0"
              style={{
                background:
                  'linear-gradient(135deg,#feda75 0%,#fa7e1e 25%,#d62976 50%,#962fbf 75%,#4f5bd5 100%)',
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* ── Floating toggle button ── */}
      <button
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-label={open ? 'Close chat' : 'Open Instagram chat'}
        className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center hover:scale-105 transition-transform ml-auto"
        style={{
          background:
            'linear-gradient(135deg,#feda75 0%,#fa7e1e 25%,#d62976 50%,#962fbf 75%,#4f5bd5 100%)',
        }}
      >
        {open ? (
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.163 6.163 0 1 0 0 12.326 6.163 6.163 0 0 0 0-12.326zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
          </svg>
        )}
      </button>
    </div>
  );
}