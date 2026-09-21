import { motion, type Variants } from "framer-motion";
import { useInView } from "react-intersection-observer";
import {
  CheckCircle,
  Wallet,
  CreditCard,
  MapPin,
  Phone,
  Globe,
  Scissors,
  Sparkles,
  Percent,
  Clock,
  Gem,
} from "lucide-react";
import type { ReactNode } from "react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

// ─── Types ───────────────────────────────────────────────────────────────
interface WalletTier {
  name: string;
  pay: string;
  receive: string;
  desc: string;
}

interface AnnualPerk {
  title: string;
  desc: string;
}

interface Faq {
  q: string;
  a: string;
}

interface AnimatedSectionProps {
  children: ReactNode;
  delay?: number;
}

// ─── DATA ───────────────────────────────────────────────────────────────────
const walletTiers: WalletTier[] = [
  {
    name: "Silver Vault",
    pay: "₹2,000",
    receive: "₹2,400",
    desc: "Pay ₹2,000 and receive a ₹2,400 balance loaded directly into your account.",
  },
  {
    name: "Gold Vault",
    pay: "₹5,000",
    receive: "₹6,200",
    desc: "Pay ₹5,000 and receive a ₹6,200 balance loaded directly into your account.",
  },
  {
    name: "Royal Vault",
    pay: "₹10,000",
    receive: "₹13,000",
    desc: "Pay ₹10,000 and receive a ₹13,000 balance loaded directly into your account.",
  },
];

const walletPerks: string[] = [
  "Wallet balances remain strictly valid for 12 months from the date of purchase.",
  "Can be redeemed seamlessly across any grooming, luxury skin care, or chemical option on the menu.",
];

const annualPerks: (AnnualPerk & { icon: typeof Scissors })[] = [
  {
    title: "6 Complimentary Haircuts",
    desc: "Valid for Basic or Advanced haircuts (limited to a maximum of 1 visit every 2 months).",
    icon: Scissors,
  },
  {
    title: "2 Complimentary Massages",
    desc: "Enjoy relaxing, premium Soothing Head Massages (Coconut or Olive variants).",
    icon: Sparkles,
  },
  {
    title: "Flat 15% Off Discount",
    desc: "Enjoy immediate savings on all high-end premium chemical hair or skin care options.",
    icon: Percent,
  },
  {
    title: "Priority Slot Configuration",
    desc: "Priority slot configuration on weekends for ultimate comfort and minimized wait times.",
    icon: Clock,
  },
];

const faqs: Faq[] = [
  { q: "Are membership benefits transferable?", a: "No. Membership balances and benefits are bound to a single user profile and are strictly non-transferable." },
  { q: "Do I need to book in advance?", a: "Prior appointment bookings are highly recommended to ensure your preferred time slot." },
  { q: "Are rates subject to change?", a: "Rates and benefits are subject to standard salon operational guidelines." },
];

// helper: derive "extra value" text from pay/receive strings, e.g. "₹2,000" / "₹2,400" -> "+₹400 bonus"
function bonusLabel(pay: string, receive: string): string {
  const num = (s: string) => Number(s.replace(/[₹,]/g, ""));
  const diff = num(receive) - num(pay);
  return `+₹${diff.toLocaleString("en-IN")} bonus`;
}

function AnimatedSection({ children, delay = 0 }: AnimatedSectionProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={fadeUp}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

export default function Membership() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] pt-20 relative overflow-hidden">

      {/* Ambient decorative glows */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#C8A96E]/10 blur-3xl" />
      <div className="pointer-events-none absolute top-64 -right-32 w-[28rem] h-[28rem] rounded-full bg-[#8B5A2B]/[0.06] blur-3xl" />

      {/* Hero */}
      <section className="relative py-10 sm:py-14 md:py-20 px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 mb-4"
        >
          <span className="h-px w-6 sm:w-8 bg-[#C8A96E]" />
          <p className="text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.3em] uppercase text-[#C8A96E] font-semibold">
            Velvet Premium Unisex Salon
          </p>
          <span className="h-px w-6 sm:w-8 bg-[#C8A96E]" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="font-serif text-3xl sm:text-4xl md:text-6xl font-bold text-[#2C1810] mb-4 leading-tight"
        >
          Membership Programs
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-[#7A6050] text-sm sm:text-base md:text-lg max-w-xl mx-auto leading-relaxed"
        >
          Experience <span className="text-[#8B5A2B] font-semibold">premium grooming redefined.</span> Enjoy unmatched upfront value, international-grade styling, uncompromising safety, and luxury comfort.
        </motion.p>
      </section>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pb-14 sm:pb-20 space-y-6 sm:space-y-10">

        {/* ── Program 1: Velvet Bank Wallet ── */}
        <AnimatedSection>
          <div className="bg-white rounded-3xl border-2 border-[#E8D9C0] overflow-hidden hover:border-[#C8A96E]/60 hover:shadow-[0_12px_50px_rgba(200,169,110,0.12)] transition-all duration-500">
            {/* Header bar */}
            <div className="relative bg-gradient-to-r from-[#C8A96E]/15 to-[#FAF7F2] border-b border-[#E8D9C0] px-5 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 overflow-hidden">
              <Wallet size={120} className="pointer-events-none absolute -right-4 -bottom-6 text-[#C8A96E]/[0.06] rotate-[-12deg]" />
              <div className="relative flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#C8A96E] to-[#8B5A2B] flex items-center justify-center shrink-0 shadow-md">
                  <span className="text-white font-serif font-bold text-base sm:text-lg">1</span>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.2em] sm:tracking-[0.25em] uppercase text-[#C8A96E] font-semibold mb-0.5">Program One</p>
                  <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-[#2C1810] leading-snug">The Velvet Bank Wallet</h2>
                </div>
              </div>
              <div className="relative sm:ml-auto flex items-center gap-2 flex-wrap">
                <Wallet size={16} className="text-[#C8A96E] shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-[#8B5A2B] tracking-wide">₹2,000 / ₹5,000 / ₹10,000</span>
              </div>
            </div>

            <div className="p-5 sm:p-8">
              {/* Vault tiers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-7">
                {walletTiers.map((t, i) => {
                  const isBest = i === walletTiers.length - 1;
                  return (
                    <div
                      key={t.name}
                      className={`relative rounded-2xl border p-5 transition-all duration-300 ${
                        isBest
                          ? "border-[#C8A96E] bg-gradient-to-b from-[#C8A96E]/10 to-[#FAF7F2] shadow-[0_8px_30px_rgba(200,169,110,0.18)] sm:scale-[1.03]"
                          : "border-[#E8D9C0] bg-[#FAF7F2] hover:border-[#C8A96E]/50"
                      }`}
                    >
                      {isBest && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#8B5A2B] text-white text-[9px] tracking-[0.15em] uppercase font-bold px-3 py-1 rounded-full shadow-md whitespace-nowrap">
                          <Gem size={10} /> Best Value
                        </span>
                      )}
                      <p className="text-xs tracking-[0.15em] uppercase text-[#C8A96E] font-bold mb-2">{t.name}</p>
                      <p className="text-[#7A6050] text-sm leading-relaxed mb-3">
                        Pay <span className="font-semibold text-[#2C1810]">{t.pay}</span> and receive a{" "}
                        <span className="font-bold text-[#8B5A2B]">{t.receive}</span> balance loaded directly into your account.
                      </p>
                      <span className="inline-block text-[11px] font-semibold text-[#8B5A2B] bg-[#C8A96E]/15 rounded-full px-2.5 py-1">
                        {bonusLabel(t.pay, t.receive)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Wallet perks */}
              <div className="space-y-3 border-t border-[#E8D9C0] pt-5">
                {walletPerks.map((p) => (
                  <div key={p} className="flex items-start gap-3">
                    <CheckCircle size={16} className="text-[#C8A96E] shrink-0 mt-0.5" />
                    <p className="text-sm text-[#7A6050] leading-relaxed">{p}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* ── Program 2: Grooming Essentials Annual Pass ── */}
        <AnimatedSection delay={0.1}>
          <div className="bg-white rounded-3xl border-2 border-[#E8D9C0] overflow-hidden hover:border-[#C8A96E]/60 hover:shadow-[0_12px_50px_rgba(200,169,110,0.12)] transition-all duration-500">
            {/* Header bar */}
            <div className="relative bg-gradient-to-r from-[#C8A96E]/15 to-[#FAF7F2] border-b border-[#E8D9C0] px-5 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 overflow-hidden">
              <CreditCard size={120} className="pointer-events-none absolute -right-4 -bottom-6 text-[#C8A96E]/[0.06] rotate-[-12deg]" />
              <div className="relative flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#C8A96E] to-[#8B5A2B] flex items-center justify-center shrink-0 shadow-md">
                  <span className="text-white font-serif font-bold text-base sm:text-lg">2</span>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.2em] sm:tracking-[0.25em] uppercase text-[#C8A96E] font-semibold mb-0.5">Program Two</p>
                  <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-[#2C1810] leading-snug">Grooming Essentials Annual Pass</h2>
                </div>
              </div>
              <div className="relative sm:ml-auto flex items-center gap-2 flex-wrap">
                <CreditCard size={16} className="text-[#C8A96E] shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-[#8B5A2B] tracking-wide">₹2,999 / Year</span>
              </div>
            </div>

            <div className="p-5 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {annualPerks.map((p) => (
                  <div
                    key={p.title}
                    className="flex items-start gap-3 rounded-2xl border border-[#E8D9C0] bg-[#FAF7F2] p-5 hover:border-[#C8A96E]/50 hover:bg-white transition-colors"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#C8A96E]/15 flex items-center justify-center shrink-0">
                      <p.icon size={15} className="text-[#8B5A2B]" />
                    </div>
                    <p className="text-sm text-[#7A6050] leading-relaxed">
                      <span className="font-semibold text-[#2C1810]">{p.title}:</span> {p.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* ── Terms / FAQ ── */}
        <AnimatedSection delay={0.15}>
          <div className="bg-[#F5EFE6] rounded-3xl border border-[#E8D9C0] p-5 sm:p-8">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#2C1810] mb-5 sm:mb-6 text-center">Terms & Conditions</h3>
            <div className="space-y-3 sm:space-y-4 max-w-2xl mx-auto">
              {faqs.map(({ q, a }) => (
                <div
                  key={q}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E8D9C0] hover:border-[#C8A96E]/50 transition-colors"
                >
                  <p className="font-semibold text-[#2C1810] text-sm mb-1.5">{q}</p>
                  <p className="text-sm text-[#7A6050] leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* ── Contact Footer ── */}
        <AnimatedSection delay={0.2}>
          <div className="text-center py-8 px-2 border-t border-[#E8D9C0]">
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-2">Visit Us</p>
            <p className="font-serif text-lg sm:text-xl font-bold text-[#2C1810] mb-4 sm:mb-5">Velvet Premium Unisex Salon</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-[#7A6050]">
              <span className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#C8A96E]/15 flex items-center justify-center shrink-0">
                  <MapPin size={13} className="text-[#8B5A2B]" />
                </span>
                Laxminagar, Bhavani
              </span>
              <span className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#C8A96E]/15 flex items-center justify-center shrink-0">
                  <Phone size={13} className="text-[#8B5A2B]" />
                </span>
                +91 9345678646
              </span>
              <span className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#C8A96E]/15 flex items-center justify-center shrink-0">
                  <Globe size={13} className="text-[#8B5A2B]" />
                </span>
                www.velvetluxurysalon.in
              </span>
            </div>
          </div>
        </AnimatedSection>

      </div>
    </div>
  );
}