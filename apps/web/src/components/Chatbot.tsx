import { useEffect, useRef, useState } from 'react';

// ─── Config ───────────────────────────────────────────────────────────────────
const WHATSAPP_NUMBER = '919994119336'; // no + or spaces, country code first
const SALON_NAME = 'Velvet Premium Unisex Salon';

interface QuickOption {
  id: string;
  label: string;
  message: string;
}

const QUICK_OPTIONS: QuickOption[] = [
  {
    id: 'book',
    label: '📅 Book an appointment',
    message: `Hi! I'd like to book an appointment at ${SALON_NAME}.`,
  },
  {
    id: 'services',
    label: '💇 Ask about services & pricing',
    message: `Hi! Could you share your services and pricing at ${SALON_NAME}?`,
  },
  {
    id: 'membership',
    label: '⭐ Membership plans',
    message: `Hi! I'd like to know more about your membership plans.`,
  },
  {
    id: 'location',
    label: '📍 Location & timings',
    message: `Hi! Could you share your location and working hours?`,
  },
  {
    id: 'other',
    label: '💬 Something else',
    message: `Hi! I have a question about ${SALON_NAME}.`,
  },
];

interface ChatMessage {
  id: string;
  from: 'bot' | 'user';
  text: string;
}

const buildWhatsAppLink = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'greet',
      from: 'bot',
      text: `Hi there! 👋 I'm the ${SALON_NAME} assistant. How can I help you today?`,
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
        text: `Great, let's continue this on WhatsApp so our team can help you right away.`,
      },
    ]);
    window.open(buildWhatsAppLink(opt.message), '_blank', 'noopener,noreferrer');
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
        text: `Thanks! Continuing this on WhatsApp so we can reply faster.`,
      },
    ]);
    window.open(buildWhatsAppLink(trimmed), '_blank', 'noopener,noreferrer');
    setCustomText('');
  };

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-5 sm:right-5 z-50 font-['Jost']">
      {/* ── Chat panel ── */}
      {open && (
        <div
          ref={panelRef}
          className="mb-3 w-[92vw] max-w-[340px] bg-white border border-[#ede5d6] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ height: 460 }}
        >
          {/* Header */}
          <div className="bg-[#1a1208] px-4 py-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 32 32" fill="currentColor">
  <path d="M16.001 3C8.83 3 3 8.83 3 16.001c0 2.475.678 4.865 1.965 6.944L3 29l6.212-1.933A12.94 12.94 0 0 0 16.001 29C23.17 29 29 23.17 29 16.001S23.17 3 16.001 3zm7.605 18.409c-.324.913-1.605 1.671-2.626 1.891-.696.148-1.605.267-4.663-1.001-3.914-1.622-6.436-5.598-6.633-5.858-.19-.26-1.599-2.129-1.599-4.061 0-1.933 1.011-2.883 1.372-3.279.324-.356.708-.446.943-.446.235 0 .47.002.675.012.235.011.522-.089.816.622.324.782 1.101 2.703 1.196 2.899.095.196.16.427.032.687-.128.26-.192.427-.384.657-.192.229-.404.512-.577.687-.192.196-.393.409-.169.804.224.396 1.002 1.653 2.15 2.678 1.478 1.318 2.725 1.727 3.121 1.923.396.196.628.164.86-.098.235-.26 1.001-1.166 1.269-1.566.267-.396.535-.33.899-.198.363.132 2.311 1.09 2.706 1.288.395.196.658.298.755.463.096.164.096.951-.226 1.864z" />
</svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#d4af37] leading-tight truncate">
                {SALON_NAME}
              </p>
              <p className="text-[11px] text-white/60">Typically replies within minutes</p>
            </div>
            <button
              onClick={() => {
                setOpen(false);
              }}
              aria-label="Close chat"
              className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white transition-colors flex-shrink-0"
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
                  className="text-left px-3.5 py-2.5 rounded-xl border border-[#e0d5c0] bg-white text-[13px] text-[#2c1f0e] hover:border-[#d4af37] hover:bg-[#fffdf5] transition-all"
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
              className="flex-1 h-10 border border-[#e0d5c0] rounded-full bg-[#faf8f4] px-4 text-[13px] text-[#2c1f0e] outline-none focus:border-[#d4af37] transition-colors placeholder:text-[#c5b89a]"
            />
            <button
              type="submit"
              disabled={!customText.trim()}
              aria-label="Send message"
              className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex-shrink-0"
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
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="w-14 h-14 rounded-full bg-[#25D366] shadow-xl flex items-center justify-center hover:scale-105 transition-transform ml-auto"
      >
        {open ? (
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
       ) : (
          <svg className="w-7 h-7 text-white" viewBox="0 0 32 32" fill="currentColor">
            <path d="M16.001 3C8.83 3 3 8.83 3 16.001c0 2.475.678 4.865 1.965 6.944L3 29l6.212-1.933A12.94 12.94 0 0 0 16.001 29C23.17 29 29 23.17 29 16.001S23.17 3 16.001 3zm7.605 18.409c-.324.913-1.605 1.671-2.626 1.891-.696.148-1.605.267-4.663-1.001-3.914-1.622-6.436-5.598-6.633-5.858-.19-.26-1.599-2.129-1.599-4.061 0-1.933 1.011-2.883 1.372-3.279.324-.356.708-.446.943-.446.235 0 .47.002.675.012.235.011.522-.089.816.622.324.782 1.101 2.703 1.196 2.899.095.196.16.427.032.687-.128.26-.192.427-.384.657-.192.229-.404.512-.577.687-.192.196-.393.409-.169.804.224.396 1.002 1.653 2.15 2.678 1.478 1.318 2.725 1.727 3.121 1.923.396.196.628.164.86-.098.235-.26 1.001-1.166 1.269-1.566.267-.396.535-.33.899-.198.363.132 2.311 1.09 2.706 1.288.395.196.658.298.755.463.096.164.096.951-.226 1.864z" />
          </svg>
        )}
      </button>
    </div>
  );
}