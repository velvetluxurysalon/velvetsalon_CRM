import { useRef } from "react";
import { motion, type Variants } from "framer-motion";
import { useInView } from "react-intersection-observer";
import {
  ArrowRight,
  PhoneCall,
  Mail,
  Clock,
  CheckCircle2,
  Sparkles,
  Building2,
  Scissors,
  Wallet,
  ClipboardCheck,
  Megaphone,
  ShieldCheck,
  Crown,
  type LucideIcon,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM ICON — lucide-react deprecated the Instagram brand icon
// ─────────────────────────────────────────────────────────────────────────────

function Instagram({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ValuePillar {
  num: string;
  title: string;
  desc: string;
}

interface ServiceRow {
  name: string;
  price: string;
}

interface ComboRow {
  name: string;
  price: string;
}

interface FocoRow {
  area: string;
  investor: boolean;
  hq: boolean;
}

interface YearOneTerm {
  term: string;
  structure: string;
}

interface PathwayRow {
  pathway: string;
  control: string;
  investor: string;
  hq: string;
}

interface CapexRow {
  item: string;
  amount: string;
}

interface TimelineRow {
  frame: string;
  milestone: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA — verbatim from the VELVET Franchise Investment Memorandum
// ─────────────────────────────────────────────────────────────────────────────

const VALUE_PILLARS: ValuePillar[] = [
  { num: "01", title: "Premium Formulations", desc: "Professional-grade salon products used across every service line." },
  { num: "02", title: "Trained Artistry", desc: "Certified styling talent operating under codified clinical hygiene protocols." },
  { num: "03", title: "Personal Consultation", desc: "Tailored service blueprints built around individual guest requirements." },
  { num: "04", title: "Considered Comfort", desc: "A quiet, premium, air-conditioned hospitality environment." },
];

const MENS_SERVICES: ServiceRow[] = [
  { name: "Precision Haircut", price: "₹199" },
  { name: "Haircut + Beard Combo", price: "₹299" },
  { name: "Full Body Massage", price: "₹999" },
  { name: "Specialized Facials", price: "As per menu" },
  { name: "Advanced Hair & Scalp Treatments", price: "Up to ₹7,999" },
];

const WOMENS_SERVICES: ServiceRow[] = [
  { name: "Precision Haircut", price: "₹349+" },
  { name: "Blowdry & Styling", price: "₹599" },
  { name: "Advanced Skincare / Facials", price: "₹399+" },
  { name: "Advanced Chemical / Texture Hair Services", price: "As per menu" },
  { name: "Luxury Bridal Experience", price: "₹29,999" },
];

const COMBO_PACKAGES: ComboRow[] = [
  { name: "Executive Grooming Combo", price: "₹449" },
  { name: "Premium Gentleman Combo", price: "₹599" },
  { name: "Luxury Transformation Combo", price: "₹1,099" },
  { name: "VELVET Beauty Combo", price: "₹1,299" },
  { name: "Premium Glow Combo", price: "₹1,699" },
  { name: "Couple Spa Retreat", price: "₹1,999" },
  { name: "Bridal Prep Combo", price: "₹2,499" },
  { name: "King & Queen Signature Package", price: "₹2,999" },
];

const FOCO_ROWS: FocoRow[] = [
  { area: "100% Setup Capital", investor: true, hq: false },
  { area: "Commercial Space Procurement & Lease Execution", investor: true, hq: false },
  { area: "Asset Ownership", investor: true, hq: false },
  { area: "Financial Review", investor: true, hq: false },
  { area: "Interior Design, Equipment & Recruitment", investor: false, hq: true },
  { area: "Daily Store Management & Centralized Procurement", investor: false, hq: true },
  { area: "Marketing Campaigns & POS / Reporting Systems", investor: false, hq: true },
  { area: "Ongoing QC Audits", investor: false, hq: true },
];

const YEAR_ONE_TERMS: YearOneTerm[] = [
  { term: "Net operating profit retained by the investor (Months 1–12)", structure: "100%" },
  { term: "Profit share taken by VELVET HQ (Year 1)", structure: "0%" },
  { term: "Operational management, staffing & marketing provided by HQ", structure: "12 full months" },
];

const PARTNERSHIP_PATHWAYS: PathwayRow[] = [
  { pathway: "Path A — Investor-Operated", control: "Investor assumes day-to-day operational control", investor: "60%", hq: "40%" },
  { pathway: "Path B — VELVET-Operated (Passive)", control: "VELVET HQ continues 100% operational management", investor: "40%", hq: "60%" },
];

const CAPEX_ROWS: CapexRow[] = [
  { item: "Interior Architecture & Execution (A to Z)", amount: "₹6,00,000" },
  { item: "Electrical Infrastructure & Lighting", amount: "₹2,00,000" },
  { item: "Salon Equipment (5 chairs, facial beds, initial stock)", amount: "₹3,50,000" },
  { item: "Air Conditioning (2 commercial units)", amount: "₹80,000" },
  { item: "Branding Infrastructure (fascia + roadside display)", amount: "₹50,000" },
  { item: "Acoustic / Sound System", amount: "₹15,000" },
  { item: "Commercial RO Water System", amount: "₹7,500" },
  { item: "Dedicated Plumbing Works", amount: "₹7,500" },
  { item: "Commercial Water Heater", amount: "₹2,000" },
];

const CAPEX_TOTAL = "₹13,12,000";

const DIGITAL_LAUNCH_KIT: string[] = [
  "3 dedicated local influencer video reels — production & local activation",
  "Social media opening collateral",
  "Google Business Profile optimization",
  "Instagram campaign setup",
  "WhatsApp CRM templates",
  "Review generation system",
  "QR-code digital booking integration",
];

const OPERATIONAL_READINESS: string[] = [
  "Staff grooming boot-camp",
  "Opening-week promotional schedules",
  "First-month marketing calendar",
  "VELVET Brand Standard Manual",
];

const DEPLOYMENT_TIMELINE: TimelineRow[] = [
  { frame: "Weeks 1–2", milestone: "Commercial site evaluation, catchment analysis, and territory lock" },
  { frame: "Week 2", milestone: "Formal franchise agreement execution" },
  { frame: "Weeks 3–8", milestone: "Civil, interior architecture, and MEP infrastructure execution" },
  { frame: "Weeks 6–9", milestone: "Staff recruitment, product onboarding, and brand SOP training" },
  { frame: "Week 10", milestone: "Grand opening, localized influencer campaign, and public launch" },
];

const COMPLIANCE_NOTES: string[] = [
  "Investment, capex, and commercial frameworks are indicative baselines based on standard salon footprints.",
  "Actual costs vary based on city, municipal compliance, square footage, and leasehold condition.",
  "Historical unit sales and menu benchmarks are not a guarantee of future performance.",
  "All operational rights, territories, exits, and final percentages are governed exclusively by the binding Master Franchise Agreement.",
];

interface DeskItem {
  icon: LucideIcon | ((props: { size?: number; className?: string }) => React.JSX.Element);
  label: string;
  value: string;
  href?: string;
}

const CONTACT_DESK: DeskItem[] = [
  { icon: Building2, label: "Entity", value: "VELVET Premium Unisex Salon" },
  { icon: PhoneCall, label: "Franchise Desk", value: "+91 93456 78646", href: "tel:+919345678646" },
  { icon: Mail, label: "Dedicated Portal", value: "franchise@velvetluxurysalon.in", href: "mailto:franchise@velvetluxurysalon.in" },
  { icon: Instagram, label: "Social", value: "@velvet_unisex", href: "https://instagram.com/velvet_unisex" },
  { icon: Clock, label: "Operations", value: "Monday – Sunday | 8:00 AM – 8:00 PM" },
];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION HELPERS (same as HomePage)
// ─────────────────────────────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.1 } } };

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
}

function AnimatedSection({ children, className = "" }: AnimatedSectionProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  return (
    <motion.div ref={ref} variants={stagger} initial="hidden" animate={inView ? "visible" : "hidden"} className={className}>
      {children}
    </motion.div>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return <p className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-2">{children}</p>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

function FranchiseHero() {
  return (
 <section
      className="relative w-full overflow-hidden flex items-center"
      style={{ minHeight: "max(600px, calc(clamp(360px,58vw,655px) + 88px))" }}
    >
      <img
        src="https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=1600&h=800&fit=crop&q=85"
        alt="VELVET Salon Interior"
        className="absolute inset-0 w-full h-full object-cover object-[65%_center] sm:object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#1A0A05]/90 via-[#2C1810]/65 to-[#2C1810]/30" />

<div className="relative z-10 flex flex-col justify-center w-full px-5 sm:px-12 md:px-20 lg:px-28 pt-28 pb-16 sm:pt-32 sm:pb-20">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <span className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white text-[10px] tracking-[0.2em] uppercase font-bold mb-4 w-fit shadow-lg">
            Franchise Investment Memorandum
          </span>
          <p className="text-[#C8A96E] text-xs tracking-[0.28em] uppercase font-semibold mb-2">
            Capital · Partnership · Growth
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-4 max-w-2xl">
            Own a VELVET Franchise
          </h1>
          <p className="text-[#E8D9C0] text-sm md:text-base max-w-lg mb-8 leading-relaxed italic">
            &ldquo;A Quiet Standard of Luxury.&rdquo; VELVET runs today as an active, proven, operating salon format —
            this structure exists to replicate it across Tier 1, Tier 2, and Tier 3 markets in a disciplined, repeatable way.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
                      <a
              href="tel:+919345678646"
              className="inline-flex items-center justify-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white font-semibold text-xs sm:text-sm tracking-widest uppercase hover:scale-105 hover:shadow-xl transition-all duration-300 w-full sm:w-fit"
            >
              <PhoneCall size={15} /> Call the Franchise Desk
            </a>
            <a
              href="mailto:franchise@velvetluxurysalon.in"
              className="inline-flex items-center justify-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-full border border-white/30 text-white font-medium text-xs sm:text-sm tracking-wider uppercase hover:bg-white/10 transition-all duration-300 w-full sm:w-fit"
            >
              <Mail size={15} /> Email Us
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOREWORD
// ─────────────────────────────────────────────────────────────────────────────

function Foreword() {
  return (
    <AnimatedSection className="py-14 md:py-20 px-4 max-w-4xl mx-auto text-center">
      <motion.div variants={fadeUp}>
        <SectionKicker>Executive Foreword</SectionKicker>
        <h2 className="font-serif text-3xl md:text-5xl font-bold text-[#2C1810] mb-6">A Structured Path to Ownership</h2>
        <p className="text-[#7A6050] text-sm md:text-base leading-relaxed mb-4">
          VELVET Premium Unisex Salon is owned and operated by Vel Enterprises Pvt Ltd. This memorandum sets out the
          operational, financial, and commercial architecture behind the brand.
        </p>
        <p className="text-[#7A6050] text-sm md:text-base leading-relaxed">
          Every figure here — capital, splits, timelines — is drawn directly from our operating model. Nothing is a
          projection dressed up as a promise. Where the structure de-risks the investor, we say so plainly.
        </p>
        <p className="text-[#C8A96E] text-xs tracking-[0.15em] uppercase font-semibold mt-6">
          With confidence, The VELVET Corporate Office
        </p>
      </motion.div>
    </AnimatedSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VALUE PILLARS
// ─────────────────────────────────────────────────────────────────────────────

function ValuePillars() {
  return (
    <AnimatedSection className="py-10 md:py-16 px-4 max-w-6xl mx-auto">
      <motion.div variants={fadeUp} className="text-center mb-10">
        <SectionKicker>Corporate Identity & Strategic Positioning</SectionKicker>
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810]">Four Value Pillars</h2>
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {VALUE_PILLARS.map(({ num, title, desc }) => (
          <motion.div
            key={num}
            variants={fadeUp}
            className="bg-white rounded-2xl p-6 border border-[#E8D9C0] hover:border-[#C8A96E]/50 hover:shadow-[0_10px_40px_rgba(200,169,110,0.14)] transition-all duration-500"
          >
            <p className="font-serif text-3xl font-bold text-[#C8A96E] mb-2">{num}</p>
            <h3 className="font-serif text-lg font-bold text-[#2C1810] mb-1.5">{title}</h3>
            <p className="text-xs text-[#7A6050] leading-relaxed">{desc}</p>
          </motion.div>
        ))}
      </div>
    </AnimatedSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE ECOSYSTEM & REVENUE BENCHMARKS
// ─────────────────────────────────────────────────────────────────────────────

function PriceList({ title, icon: Icon, rows }: { title: string; icon: LucideIcon; rows: ServiceRow[] }) {
  return (
    <motion.div variants={fadeUp} className="bg-white rounded-2xl p-6 md:p-7 border border-[#E8D9C0]">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C8A96E] to-[#8B5A2B] flex items-center justify-center shrink-0">
          <Icon size={16} className="text-white" />
        </div>
        <h3 className="font-serif text-lg font-bold text-[#2C1810]">{title}</h3>
      </div>
      <div className="space-y-3">
        {rows.map(({ name, price }) => (
          <div key={name} className="flex items-baseline justify-between gap-4 border-b border-dashed border-[#E8D9C0] pb-2">
            <span className="text-xs md:text-sm text-[#4A3728]">{name}</span>
            <span className="text-xs md:text-sm font-semibold text-[#8B5A2B] whitespace-nowrap">{price}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ServiceEcosystem() {
  return (
    <AnimatedSection className="py-14 md:py-20 px-4 max-w-6xl mx-auto">
      <motion.div variants={fadeUp} className="text-center mb-10">
        <SectionKicker>Service Ecosystem & Revenue Benchmarks</SectionKicker>
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810]">Published Menu Baselines</h2>
      </motion.div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <PriceList title="Men's Services" icon={Scissors} rows={MENS_SERVICES} />
        <PriceList title="Women's Services" icon={Sparkles} rows={WOMENS_SERVICES} />
      </div>

      <motion.div variants={fadeUp} className="bg-white rounded-2xl p-6 md:p-7 border border-[#E8D9C0]">
        <h3 className="font-serif text-lg font-bold text-[#2C1810] mb-1">High-Margin Curated Packages</h3>
        <p className="text-xs text-[#9E8572] mb-5">
          Bridal & Specialized Occasions: bridal makeup, hair architecture, saree draping, saree pre-pleating, floral
          settings, and signature glow pre-bridal facials.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {COMBO_PACKAGES.map(({ name, price }) => (
            <div key={name} className="flex items-baseline justify-between gap-4 border-b border-dashed border-[#E8D9C0] pb-2">
              <span className="text-xs md:text-sm text-[#4A3728]">{name}</span>
              <span className="text-xs md:text-sm font-semibold text-[#8B5A2B] whitespace-nowrap">{price}</span>
            </div>
          ))}
        </div>
      </motion.div>
      <motion.p variants={fadeUp} className="text-[10px] text-[#9E8572] italic mt-4 text-center">
        Pricing represents published baseline menu benchmarks and is subject to local territory adaptation. Historical
        unit sales and menu benchmarks are not a guarantee of future performance.
      </motion.p>
    </AnimatedSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCO OPERATING MODEL
// ─────────────────────────────────────────────────────────────────────────────

function CheckOrDash({ on }: { on: boolean }) {
  return on ? (
    <CheckCircle2 size={17} className="text-[#8B5A2B] mx-auto" />
  ) : (
    <span className="text-[#D9C9B8] text-sm">—</span>
  );
}

function FocoModel() {
  return (
    <AnimatedSection className="py-14 md:py-20 px-4 max-w-5xl mx-auto">
      <motion.div variants={fadeUp} className="text-center mb-10">
        <SectionKicker>The Operating Model</SectionKicker>
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810] mb-3">
          FOCO — Franchise-Owned, Company-Operated
        </h2>
        <p className="text-[#7A6050] text-sm max-w-2xl mx-auto leading-relaxed">
          The investor supplies capital and the commercial site; VELVET Corporate manages operations, personnel, brand
          standards, and the supply chain.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-[#E8D9C0] overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] bg-[#2C1810] text-white text-xs md:text-sm font-semibold tracking-wide uppercase">
          <div className="px-4 md:px-6 py-3.5">Responsibility Area</div>
          <div className="px-4 md:px-6 py-3.5 text-center w-28 md:w-36">Investor</div>
          <div className="px-4 md:px-6 py-3.5 text-center w-28 md:w-36">VELVET HQ</div>
        </div>
        {FOCO_ROWS.map(({ area, investor, hq }, i) => (
          <div
            key={area}
            className={`grid grid-cols-[1fr_auto_auto] items-center text-xs md:text-sm ${
              i % 2 === 0 ? "bg-[#FAF7F2]" : "bg-white"
            }`}
          >
            <div className="px-4 md:px-6 py-3 text-[#4A3728]">{area}</div>
            <div className="px-4 md:px-6 py-3 text-center w-28 md:w-36">
              <CheckOrDash on={investor} />
            </div>
            <div className="px-4 md:px-6 py-3 text-center w-28 md:w-36">
              <CheckOrDash on={hq} />
            </div>
          </div>
        ))}
      </motion.div>
    </AnimatedSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMERCIAL TERMS & YEAR-1 STRUCTURE
// ─────────────────────────────────────────────────────────────────────────────

function CommercialTerms() {
  return (
    <AnimatedSection className="py-14 md:py-20 px-4 max-w-5xl mx-auto">
      <motion.div variants={fadeUp} className="text-center mb-10">
        <SectionKicker>Commercial Terms</SectionKicker>
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810]">The Year-1 Structure</h2>
      </motion.div>

      <motion.div variants={fadeUp} className="mb-8">
        <h3 className="font-serif text-base font-bold text-[#2C1810] mb-3">The Year-1 Incentive</h3>
        <div className="bg-white rounded-2xl border border-[#E8D9C0] overflow-hidden">
          {YEAR_ONE_TERMS.map(({ term, structure }, i) => (
            <div
              key={term}
              className={`flex items-center justify-between gap-4 px-4 md:px-6 py-3.5 text-xs md:text-sm ${
                i % 2 === 0 ? "bg-[#FAF7F2]" : "bg-white"
              }`}
            >
              <span className="text-[#4A3728]">{term}</span>
              <span className="font-bold text-[#8B5A2B] whitespace-nowrap">{structure}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={fadeUp}>
        <h3 className="font-serif text-base font-bold text-[#2C1810] mb-3">Post-Year-1 Long-Term Partnership Pathways</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {PARTNERSHIP_PATHWAYS.map(({ pathway, control, investor, hq }) => (
            <div key={pathway} className="bg-white rounded-2xl p-5 border border-[#E8D9C0]">
              <h4 className="font-serif text-sm font-bold text-[#2C1810] mb-1.5">{pathway}</h4>
              <p className="text-xs text-[#7A6050] leading-relaxed mb-4">{control}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl bg-[#FAF7F2] border border-[#E8D9C0] py-2.5 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-[#9E8572]">Investor</p>
                  <p className="font-serif text-lg font-bold text-[#8B5A2B]">{investor}</p>
                </div>
                <div className="flex-1 rounded-xl bg-[#FAF7F2] border border-[#E8D9C0] py-2.5 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-[#9E8572]">VELVET HQ</p>
                  <p className="font-serif text-lg font-bold text-[#8B5A2B]">{hq}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.p variants={fadeUp} className="text-[10px] text-[#9E8572] italic mt-5 text-center">
        All splits, tenures, territories, and renewals are subject to the final executed franchise agreement. Explicitly
        not a guaranteed-profit scheme.
      </motion.p>
    </AnimatedSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPEX
// ─────────────────────────────────────────────────────────────────────────────

function CapexSetup() {
  return (
    <AnimatedSection className="py-14 md:py-20 px-4 max-w-4xl mx-auto">
      <motion.div variants={fadeUp} className="text-center mb-10">
        <SectionKicker>Capital Expenditure</SectionKicker>
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810]">CAPEX Setup</h2>
      </motion.div>

      <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-[#E8D9C0] overflow-hidden">
        {CAPEX_ROWS.map(({ item, amount }, i) => (
          <div
            key={item}
            className={`flex items-center justify-between gap-4 px-4 md:px-6 py-3.5 text-xs md:text-sm ${
              i % 2 === 0 ? "bg-[#FAF7F2]" : "bg-white"
            }`}
          >
            <span className="text-[#4A3728]">{item}</span>
            <span className="font-semibold text-[#8B5A2B] whitespace-nowrap">{amount}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-4 bg-gradient-to-r from-[#2C1810] to-[#4A2C1A]">
          <span className="text-white font-serif text-sm md:text-base font-bold uppercase tracking-wide">
            Total Base Setup Investment
          </span>
          <span className="font-serif text-xl md:text-2xl font-bold text-[#C8A96E] whitespace-nowrap">{CAPEX_TOTAL}</span>
        </div>
      </motion.div>

      <motion.p variants={fadeUp} className="text-xs text-[#7A6050] leading-relaxed mt-4">
        <span className="font-semibold text-[#8B5A2B]">Additional Site-Specific Variable Capital</span> (evaluated per
        site, not included above): commercial security deposit, working capital reserve, pre-launch marketing, and site
        contingencies.
      </motion.p>
    </AnimatedSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LAUNCH ACCELERATOR
// ─────────────────────────────────────────────────────────────────────────────

function LaunchAccelerator() {
  return (
    <AnimatedSection className="py-14 md:py-20 px-4 max-w-5xl mx-auto">
      <motion.div variants={fadeUp} className="text-center mb-10">
        <SectionKicker>Included at Zero Additional Fee</SectionKicker>
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810]">Complimentary Launch Accelerator</h2>
        <p className="text-[#7A6050] text-sm mt-2">Provided by VELVET HQ for eligible partner launches.</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <motion.div variants={fadeUp} className="bg-white rounded-2xl p-6 border border-[#E8D9C0]">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C8A96E] to-[#8B5A2B] flex items-center justify-center shrink-0">
              <Megaphone size={16} className="text-white" />
            </div>
            <h3 className="font-serif text-base font-bold text-[#2C1810]">Digital Launch Kit</h3>
          </div>
          <ul className="space-y-2.5">
            {DIGITAL_LAUNCH_KIT.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-[#4A3728] leading-relaxed">
                <CheckCircle2 size={14} className="text-[#C8A96E] shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div variants={fadeUp} className="bg-white rounded-2xl p-6 border border-[#E8D9C0]">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C8A96E] to-[#8B5A2B] flex items-center justify-center shrink-0">
              <ClipboardCheck size={16} className="text-white" />
            </div>
            <h3 className="font-serif text-base font-bold text-[#2C1810]">Operational Readiness</h3>
          </div>
          <ul className="space-y-2.5">
            {OPERATIONAL_READINESS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-[#4A3728] leading-relaxed">
                <CheckCircle2 size={14} className="text-[#C8A96E] shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </AnimatedSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPLOYMENT TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

function DeploymentTimeline() {
  return (
    <AnimatedSection className="py-14 md:py-20 px-4 max-w-4xl mx-auto">
      <motion.div variants={fadeUp} className="text-center mb-10">
        <SectionKicker>Target: ~10 Weeks</SectionKicker>
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810]">Deployment Timeline</h2>
      </motion.div>

      <div className="relative">
        <div className="hidden sm:block absolute left-[27px] top-2 bottom-2 w-px bg-[#E8D9C0]" />
        <div className="space-y-5">
          {DEPLOYMENT_TIMELINE.map(({ frame, milestone }, i) => (
            <motion.div key={frame} variants={fadeUp} className="relative flex gap-4 sm:gap-6 items-start">
              <div className="relative z-10 w-14 h-14 rounded-full bg-gradient-to-br from-[#C8A96E] to-[#8B5A2B] flex items-center justify-center text-white font-serif text-xs font-bold shrink-0 shadow-md text-center leading-tight px-1">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="bg-white rounded-2xl p-5 border border-[#E8D9C0] flex-1">
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#C8A96E] font-semibold mb-1">{frame}</p>
                <p className="text-sm text-[#2C1810] font-medium leading-relaxed">{milestone}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLIANCE & CONTACT DESK
// ─────────────────────────────────────────────────────────────────────────────

function ComplianceAndContact() {
  return (
    <AnimatedSection className="py-14 md:py-20 px-4 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Compliance */}
        <motion.div variants={fadeUp} className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#E8D9C0]">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C8A96E] to-[#8B5A2B] flex items-center justify-center shrink-0">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <h3 className="font-serif text-base font-bold text-[#2C1810]">Compliance & Legal Disclaimer</h3>
          </div>
          <ul className="space-y-2.5">
            {COMPLIANCE_NOTES.map((note) => (
              <li key={note} className="flex items-start gap-2 text-[11px] text-[#7A6050] leading-relaxed">
                <span className="text-[#C8A96E] shrink-0 mt-0.5">—</span>
                {note}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Contact desk */}
        <motion.div
          variants={fadeUp}
          className="lg:col-span-3 bg-gradient-to-br from-[#2C1810] to-[#4A2C1A] rounded-2xl p-6 md:p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-[#C8A96E]/10 blur-3xl pointer-events-none" />
          <p className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-1 relative">Corporate Contact Desk</p>
          <p className="text-[#A89070] text-xs mb-6 relative">For site evaluation and territory lock, reach the franchise desk directly.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
            {CONTACT_DESK.map(({ icon: Icon, label, value, href }) => {
              const content = (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={14} className="text-[#C8A96E]" />
                  </div>
                  <div>
                    <p className="text-[10px] tracking-wider uppercase text-[#A89070]">{label}</p>
                    <p className="text-sm text-white font-medium leading-snug">{value}</p>
                  </div>
                </div>
              );
              return href ? (
                <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                  {content}
                </a>
              ) : (
                <div key={label}>{content}</div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatedSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA BANNER
// ─────────────────────────────────────────────────────────────────────────────

function FranchiseCTA() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });
  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7 }}
      className="py-16 px-4 pb-28 md:pb-16"
    >
      <div className="max-w-4xl mx-auto bg-gradient-to-br from-[#2C1810] to-[#4A2C1A] rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-[#C8A96E]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-[#8B5A2B]/10 blur-2xl pointer-events-none" />
        <Crown size={34} className="text-[#C8A96E] mx-auto mb-4" />
        <h2 className="font-serif text-3xl md:text-5xl text-white font-bold mb-3">Bring VELVET to Your City</h2>
        <p className="text-[#A89070] text-sm md:text-base mb-8 max-w-md mx-auto leading-relaxed">
          Investment starts at ₹13,12,000 base setup. Join a proven, FOCO-operated luxury salon brand with full
          operational support from Day 1.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <a
            href="tel:+919345678646"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white font-semibold tracking-widest uppercase text-sm hover:scale-105 hover:shadow-xl transition-all duration-300"
          >
            <PhoneCall size={16} /> Call the Franchise Desk
          </a>
          <a
            href="https://wa.me/919345678646?text=Hi%20Velvet%20Salon%2C%20I'm%20interested%20in%20a%20franchise%20opportunity."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-[#C8A96E]/40 text-[#C8A96E] font-medium tracking-wider uppercase text-sm hover:bg-[#C8A96E]/10 transition-all duration-300"
          >
            WhatsApp Enquiry <ArrowRight size={15} />
          </a>
        </div>
        <div className="flex items-center justify-center gap-2 mt-6">
          <Wallet size={13} className="text-[#C8A96E]" />
          <p className="text-[10px] text-[#A89070] uppercase tracking-wider">
            Figures are indicative baselines, not guaranteed returns — subject to the executed Master Franchise Agreement.
          </p>
        </div>
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FRANCHISE PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function FranchisePage() {
  const topRef = useRef<HTMLDivElement>(null);

  return (
<div ref={topRef} className="bg-[#FAF7F2] min-h-screen overflow-hidden">
      <FranchiseHero />
      <Foreword />
      <ValuePillars />
      <ServiceEcosystem />
      <FocoModel />
      <CommercialTerms />
      <CapexSetup />
      <LaunchAccelerator />
      <DeploymentTimeline />
      <ComplianceAndContact />
      <FranchiseCTA />
    </div>
  );
}