import { motion, type Variants } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Heart, Star, Shield, Clock, Award,
  CheckCircle, Crown, ChevronDown, ChevronUp, Zap, Eye, Droplets, Sparkles,
  CalendarCheck, Users, type LucideIcon,
} from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

// Same key the homepage's "For Her" / "For Him" cards write to before
// navigating here. Read once on mount, then cleared immediately.
const GENDER_FILTER_KEY = "velvet_gender_filter";

// ─── Types ───────────────────────────────────────────────────────────────
interface ServiceItem {
  name: string;
  price: number;
}

interface ComboItem {
  name: string;
  price: number;
  totalValue?: number | null;
  save?: number | null;
  tag?: string;
  items: string[];
}

interface CoupleComboItem {
  name: string;
  price: number;
  totalValue?: number | null;
  save?: number | null;
  tag?: string;
  forHim: string[];
  forHer: string[];
}

interface BridalExperience {
  name: string;
  price: number;
  items: string[];
}

interface WhyPoint {
  icon: LucideIcon;
  title: string;
  desc: string;
}

interface PremiumBadge {
  icon: LucideIcon;
  text: string;
}

interface HygieneItem {
  title: string;
  detail: string;
}

interface ProductBrand {
  brand: string;
  desc: string;
  tags: string[];
}

// ─── DATA (sourced from VELVET Men's / Women's / Combo Offers Menu Books) ──
// NOTE: these names are kept IDENTICAL to the optgroup labels/options used in
// Contact.jsx's SERVICE_GROUPS so the dropdown there matches automatically.

// ── MEN'S SERVICES ──────────────────────────────────────────────────────
const menHairGrooming: ServiceItem[] = [
  { name: "Head Shave", price: 99 },
  { name: "Kids Hair Cut", price: 149 },
  { name: "Beard Trim & Shape", price: 149 },
  { name: "Hair Cut", price: 199 },
  { name: "Hair Cut + Beard Combo", price: 299 },
  { name: "Hair Colour (Global)", price: 399 },
];

const menMassageServices: ServiceItem[] = [
  { name: "Head Massage", price: 199 },
  { name: "Head & Shoulder Massage", price: 299 },
  { name: "Back & Neck Massage", price: 449 },
  { name: "Full Body Massage", price: 999 },
];

const menHairTreatments: ServiceItem[] = [
  { name: "Coconut Hot Oil Massage", price: 449 },
  { name: "Hair Spa Basic", price: 499 },
  { name: "Hot Oil Massage", price: 599 },
  { name: "Aroma Oil Therapy", price: 599 },
  { name: "Herbal Hot Oil Massage", price: 699 },
  { name: "Anti-Dandruff Treatment", price: 699 },
  { name: "Scalp Detox Therapy", price: 749 },
  { name: "Hair Spa Deep Conditioning", price: 799 },
  { name: "Hair Fall Control Treatment", price: 899 },
  { name: "Hair Colouring Global", price: 1399 },
  { name: "Hair Highlighting", price: 1599 },
  { name: "Keratin Treatment", price: 3499 },
  { name: "Hair Smoothening", price: 3499 },
  { name: "Permanent Hair Straightening", price: 3499 },
  { name: "Hair Botox Treatment", price: 5999 },
  { name: "Nano Plastia", price: 7999 },
];

const menFacialCollection: ServiceItem[] = [
  { name: "Cleanup Basic", price: 399 },
  { name: "Fruit Facial", price: 699 },
  { name: "Glow Facial", price: 799 },
  { name: "Papaya Facial", price: 799 },
  { name: "Pearl Facial", price: 799 },
  { name: "Tan Removing Facial", price: 899 },
  { name: "Herbal Facial + Dermamask", price: 899 },
  { name: "Skin Whitening Facial", price: 899 },
  { name: "Deep Whitening Facial", price: 899 },
  { name: "Green Tea Facial", price: 1149 },
  { name: "Gold Facial", price: 1149 },
  { name: "Normal Facial + Deep Whitening Mask", price: 1149 },
  { name: "Anti Ageing Facial", price: 1299 },
  { name: "Aroma Facial", price: 1399 },
  { name: "Chocolate Facial", price: 1399 },
  { name: "Wine Facial", price: 1399 },
  { name: "Diamond Facial", price: 1499 },
  { name: "24 Carat Gold Facial", price: 1499 },
];

const menGroomingPackages: ServiceItem[] = [
  { name: "Express Grooming", price: 349 },
  { name: "Premium Grooming", price: 699 },
];

// ── WOMEN'S SERVICES ────────────────────────────────────────────────────
const womenThreading: ServiceItem[] = [
  { name: "Upper Lip Threading", price: 39 },
  { name: "Eyebrow Threading", price: 49 },
  { name: "Chin Threading", price: 49 },
  { name: "Full Face Threading", price: 139 },
];

const womenHairCuts: ServiceItem[] = [
  { name: "Baby Cut", price: 249 },
  { name: "Straight Cut", price: 299 },
  { name: "U Cut", price: 349 },
  { name: "V Cut", price: 349 },
  { name: "Layer Cut", price: 799 },
  { name: "Step Cut", price: 799 },
  { name: "Feather Cut", price: 799 },
  { name: "Butterfly Cut", price: 799 },
  { name: "Customized Hair Cut", price: 1199 },
];

const womenHairStyling: ServiceItem[] = [
  { name: "Hair Wash & Blow Dry", price: 249 },
  { name: "Hair Ironing", price: 499 },
  { name: "Hair Styling", price: 599 },
];

const womenHairTreatments: ServiceItem[] = [
  { name: "Coconut Hot Oil Massage", price: 459 },
  { name: "Hot Oil Massage", price: 579 },
  { name: "Aroma Oil Therapy", price: 579 },
  { name: "Hair Spa Basic", price: 699 },
  { name: "Herbal Hot Oil Massage", price: 699 },
  { name: "Anti-Dandruff Treatment", price: 699 },
  { name: "Scalp Detox Therapy", price: 749 },
  { name: "Hair Fall Control Treatment", price: 919 },
  { name: "Hair Spa Deep Conditioning", price: 1199 },
];

const womenAdvancedHairServices: ServiceItem[] = [
  { name: "Global Hair Colour", price: 1379 },
  { name: "Hair Highlighting", price: 1599 },
  { name: "Keratin Treatment", price: 3449 },
  { name: "Hair Smoothening", price: 3449 },
  { name: "Permanent Hair Straightening", price: 3449 },
  { name: "Hair Botox Treatment", price: 5749 },
  { name: "Nano Plastia", price: 7999 },
];

const womenWaxing: ServiceItem[] = [
  { name: "Underarm Waxing", price: 119 },
  { name: "Half Arms Waxing", price: 249 },
  { name: "Half Legs Waxing", price: 329 },
  { name: "Full Arms Waxing", price: 399 },
  { name: "Full Legs Waxing", price: 519 },
  { name: "Full Body Waxing", price: 1379 },
];

const womenBleach: ServiceItem[] = [
  { name: "Neck Bleach", price: 229 },
  { name: "Underarm Bleach", price: 229 },
  { name: "Half Hand Bleach", price: 229 },
  { name: "Gold Bleach", price: 349 },
  { name: "Oxy Bleach", price: 349 },
  { name: "Fruit Bleach", price: 349 },
  { name: "Full Hand Bleach", price: 459 },
  { name: "Diamond Bleach", price: 579 },
  { name: "Charcoal Bleach", price: 579 },
  { name: "Full Body Bleach", price: 1729 },
];

const womenFacialCollection: ServiceItem[] = [
  { name: "Cleanup Basic", price: 399 },
  { name: "De-Tan", price: 399 },
  { name: "Fruit Facial", price: 699 },
  { name: "Glow Facial", price: 799 },
  { name: "Papaya Facial", price: 799 },
  { name: "Pearl Facial", price: 799 },
  { name: "Tan Removing Facial", price: 919 },
  { name: "Herbal Facial + Dermamask", price: 919 },
  { name: "Skin Whitening Facial", price: 919 },
  { name: "Deep Whitening Facial", price: 919 },
  { name: "Green Tea Facial", price: 1149 },
  { name: "Gold Facial", price: 1149 },
  { name: "Normal Facial + Deep Whitening Mask", price: 1149 },
  { name: "Anti Ageing Facial", price: 1269 },
  { name: "Aroma Facial", price: 1379 },
  { name: "Chocolate Facial", price: 1379 },
  { name: "Wine Facial", price: 1379 },
  { name: "Diamond Facial", price: 1499 },
  { name: "24 Carat Gold Facial", price: 1499 },
];

const womenManicurePedicure: ServiceItem[] = [
  { name: "Classic Manicure", price: 349 },
  { name: "Classic Pedicure", price: 459 },
  { name: "Spa Manicure", price: 629 },
  { name: "Spa Pedicure", price: 799 },
];

// ── SIGNATURE BRIDAL EXPERIENCE ─────────────────────────────────────────
const bridalExperience: BridalExperience = {
  name: "Signature Bridal Experience",
  price: 29999,
  items: [
    "Bridal Makeup",
    "Hair Styling",
    "Saree Draping",
    "Saree Pre-Pleating",
    "Flower Setting",
    "Bridal Jewellery Set",
    "Signature Glow Facial",
  ],
};

// ── COMBO OFFERS ────────────────────────────────────────────────────────
const menCombos: ComboItem[] = [
  {
    name: "Executive Grooming Combo",
    price: 449,
    totalValue: 547,
    save: 98,
    tag: "Most Booked",
    items: ["Hair Cut — ₹199", "Beard Trim & Shape — ₹149", "Head Massage — ₹199"],
  },
  {
    name: "Premium Gentleman Combo",
    price: 599,
    totalValue: 946,
    save: 347,
    tag: "Best Value",
    items: ["Hair Cut — ₹199", "Beard Trim — ₹149", "Cleanup Basic — ₹399", "Head Massage — ₹199"],
  },
  {
    name: "Luxury Transformation Combo",
    price: 1099,
    totalValue: 1646,
    save: 547,
    tag: "Premium Pick",
    items: ["Hair Cut — ₹199", "Beard Trim — ₹149", "Premium Facial — ₹799", "Hair Spa Basic — ₹499"],
  },
  {
    name: "Wedding Groom Combo",
    price: 1499,
    totalValue: 2195,
    save: 696,
    tag: "Special Occasion",
    items: ["Hair Cut — ₹199", "Beard Styling — ₹149", "Gold Facial — ₹1,149", "Hair Spa — ₹499", "Head Massage — ₹199"],
  },
];

const womenCombos: ComboItem[] = [
  {
    name: "Glow Express Combo",
    price: 599,
    totalValue: 736,
    save: 137,
    tag: "Quick Beauty Fix",
    items: ["Eyebrow Threading — ₹49", "Upper Lip — ₹39", "Cleanup Basic — ₹399", "Hair Wash & Blow Dry — ₹249"],
  },
  {
    name: "VELVET Beauty Combo",
    price: 1299,
    totalValue: 1607,
    save: 308,
    tag: "Customer Favorite",
    items: ["Hair Cut — ₹349", "Facial — ₹799", "Classic Pedicure — ₹459"],
  },
  {
    name: "Premium Glow Combo",
    price: 1699,
    totalValue: 2306,
    save: 607,
    tag: "Premium Experience",
    items: ["Hair Spa Basic — ₹699", "Facial — ₹799", "Manicure — ₹349", "Pedicure — ₹459"],
  },
  {
    name: "Bridal Prep Combo",
    price: 2499,
    totalValue: 3686,
    save: 1187,
    tag: "Bridal Favorite",
    items: ["Facial — ₹1,149", "Full Body Wax — ₹1,379", "Hair Spa — ₹699", "Pedicure — ₹459"],
  },
];

const coupleCombos: CoupleComboItem[] = [
  {
    name: "Date Night Combo",
    price: 899,
    totalValue: 1346,
    save: 447,
    tag: "Perfect For Couples",
    forHim: ["Hair Cut — ₹199", "Beard Trim — ₹149"],
    forHer: ["Hair Styling — ₹599", "Cleanup — ₹399"],
  },
  {
    name: "Couple Spa Retreat",
    price: 1999,
    totalValue: 2696,
    save: 697,
    tag: "Weekend Special",
    forHim: ["Facial — ₹699", "Hair Spa — ₹499"],
    forHer: ["Facial — ₹799", "Hair Spa — ₹699"],
  },
  {
    name: "King & Queen Package",
    price: 2999,
    totalValue: null,
    save: null,
    tag: "Ultimate Luxury Package",
    forHim: ["Hair Cut", "Beard Trim", "Facial", "Hair Spa"],
    forHer: ["Hair Styling", "Facial", "Pedicure", "Hair Spa"],
  },
];

const whyChoosePoints: WhyPoint[] = [
  {
    icon: Shield,
    title: "Hygiene First, Always",
    desc: "Every tool is sterilized before each client. We use single-use applicators, disposable liners, and hospital-grade sanitizers throughout the salon.",
  },
  {
    icon: Award,
    title: "Premium Products Only",
    desc: "We exclusively use L'Oreal, Wella, and other internationally certified brands — no substitutes, no compromises on quality.",
  },
  {
    icon: Star,
    title: "Expert Stylists",
    desc: "Our team undergoes continuous training with global brands. Every stylist is certified and passionate about their craft.",
  },
  {
    icon: Heart,
    title: "Client-First Philosophy",
    desc: "We listen before we cut. Your vision guides every service. We won't rush you, upsell you, or leave you unhappy.",
  },
  {
    icon: Droplets,
    title: "Safe & Skin-Tested",
    desc: "All chemical services include a mandatory patch test. We stock ammonia-free and hypoallergenic alternatives for sensitive skin.",
  },
  {
    icon: Clock,
    title: "Respect for Your Time",
    desc: "No overbooking. Appointments are honoured on time. A seamless experience from arrival to farewell.",
  },
  {
    icon: Zap,
    title: "Modern Techniques",
    desc: "From Nano Plastia to Hair Botox to Signature Bridal styling — we invest in the latest technology so you get the best results.",
  },
  {
    icon: Eye,
    title: "Transparent Pricing",
    desc: "What you see on our menu is what you pay. No hidden charges, no surprise add-ons. Honest service, every visit.",
  },
];

// Flat list used to build JSON-LD structured data
const ALL_SERVICES_FOR_SEO: ServiceItem[] = [
  ...menHairGrooming, ...menMassageServices, ...menHairTreatments, ...menFacialCollection, ...menGroomingPackages,
  ...womenThreading, ...womenHairCuts, ...womenHairStyling, ...womenHairTreatments, ...womenAdvancedHairServices,
  ...womenWaxing, ...womenBleach, ...womenFacialCollection, ...womenManicurePedicure,
];

// ─── BOOK NOW BUTTON ────────────────────────────────────────────────────────

interface BookNowButtonProps {
  service: string;
  price: number;
  size?: "sm" | "lg";
}

function BookNowButton({ service, price, size = "sm" }: BookNowButtonProps) {
  const navigate = useNavigate();

  const handleBook = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    void navigate("/contact", { state: { service, price } });
  };

  if (size === "sm") {
    return (
      <button
        onClick={handleBook}
        className="shrink-0 inline-flex items-center gap-1.5 text-[10px] tracking-wider uppercase font-semibold text-[#8B5A2B] border border-[#C8A96E]/50 rounded-full px-3 py-1.5 hover:bg-[#C8A96E] hover:text-white hover:border-[#C8A96E] transition-all duration-200 ml-3"
      >
        <CalendarCheck size={12} />
        Book Now
      </button>
    );
  }

  return (
    <button
      onClick={handleBook}
      className="w-full mt-2 inline-flex items-center justify-center gap-2 text-xs tracking-widest uppercase font-semibold text-white bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] rounded-full py-2.5 hover:shadow-md hover:scale-[1.02] transition-all duration-300"
    >
      <CalendarCheck size={14} />
      Book Now
    </button>
  );
}

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

interface ServiceRowProps {
  name: string;
  price: number;
  index: number;
}

function ServiceRow({ name, price, index }: ServiceRowProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.05 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -15 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.4, delay: (index % 8) * 0.04 }}
      className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8D9C0] hover:bg-[#F5EFE6] transition-colors duration-200 group"
    >
      <span className="text-[#5A4535] text-sm group-hover:text-[#2C1810] transition-colors">{name}</span>
      <div className="flex items-center shrink-0 ml-4">
        <span className="text-[#8B5A2B] font-semibold text-sm">₹{price.toLocaleString("en-IN")}</span>
        <BookNowButton service={name} price={price} />
      </div>
    </motion.div>
  );
}

function ServiceTable({ services }: { services: ServiceItem[] }) {
  return (
    <div className="rounded-xl overflow-hidden border border-[#E8D9C0]">
      {services.map((s, i) => (
        <ServiceRow key={s.name} name={s.name} price={s.price} index={i} />
      ))}
    </div>
  );
}

interface AccordionSectionProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  services?: ServiceItem[];
  defaultOpen?: boolean;
  children?: ReactNode;
}

function AccordionSection({ eyebrow, title, subtitle, services, defaultOpen = true, children }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.05 });
  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={fadeUp}
      className="mb-12"
    >
      <button
        onClick={() => { setOpen(o => !o); }}
        className="w-full flex items-center justify-between mb-6 group"
      >
        <div className="text-left">
          <p className="text-[10px] tracking-[0.25em] uppercase text-[#C8A96E] font-semibold mb-1">{eyebrow}</p>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2C1810] group-hover:text-[#8B5A2B] transition-colors">{title}</h2>
          {subtitle && <p className="text-[#7A6050] text-xs mt-1">{subtitle}</p>}
        </div>
        <div className="w-8 h-8 rounded-full border border-[#E8D9C0] flex items-center justify-center text-[#8B5A2B] group-hover:border-[#C8A96E]/60 transition-colors shrink-0 ml-4">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {open && (children ?? (services ? <ServiceTable services={services} /> : null))}
    </motion.section>
  );
}

function ComboCard({ combo, index }: { combo: ComboItem; index: number }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      transition={{ delay: index * 0.1 }}
      className="group bg-white rounded-2xl border border-[#E8D9C0] p-6 hover:border-[#C8A96E]/60 hover:shadow-[0_12px_50px_rgba(200,169,110,0.12)] transition-all duration-500"
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-serif text-lg font-bold text-[#2C1810] leading-snug pr-3">{combo.name}</h4>
      </div>
      {combo.tag && (
        <span className="inline-block text-[9px] tracking-[0.15em] uppercase font-bold px-2.5 py-1 rounded-full bg-[#C8A96E]/15 text-[#8B5A2B] border border-[#C8A96E]/30 mb-3">
          ★ {combo.tag}
        </span>
      )}
      <ul className="space-y-1.5 mb-4 mt-2">
        {combo.items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-[#7A6050] text-sm">
            <span className="w-1 h-1 rounded-full bg-[#C8A96E] shrink-0" />
            {item}
          </li>
        ))}
      </ul>
      <div className="flex items-end justify-between border-t border-[#E8D9C0] pt-3">
        <div>
          {combo.totalValue && (
            <p className="text-[#B8A088] text-xs line-through mb-0.5">Total Value ₹{combo.totalValue.toLocaleString("en-IN")}</p>
          )}
          <p className="text-[#8B5A2B] font-bold text-xl">₹{combo.price.toLocaleString("en-IN")}</p>
        </div>
        {combo.save ? (
          <span className="text-[#8B5A2B] text-xs italic font-semibold">Save ₹{combo.save.toLocaleString("en-IN")}</span>
        ) : (
          <span className="text-[#8B5A2B] text-xs italic font-semibold">Save Big Today</span>
        )}
      </div>
      <BookNowButton service={combo.name} price={combo.price} size="lg" />
    </motion.div>
  );
}

function CoupleComboCard({ combo, index }: { combo: CoupleComboItem; index: number }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      transition={{ delay: index * 0.1 }}
      className="group bg-white rounded-2xl border border-[#E8D9C0] p-6 hover:border-[#C8A96E]/60 hover:shadow-[0_12px_50px_rgba(200,169,110,0.12)] transition-all duration-500"
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-serif text-lg font-bold text-[#2C1810] leading-snug pr-3">{combo.name}</h4>
      </div>
      {combo.tag && (
        <span className="inline-block text-[9px] tracking-[0.15em] uppercase font-bold px-2.5 py-1 rounded-full bg-[#C8A96E]/15 text-[#8B5A2B] border border-[#C8A96E]/30 mb-3">
          ★ {combo.tag}
        </span>
      )}
      <div className="grid grid-cols-2 gap-4 mt-2 mb-4">
        <div>
          <p className="text-[9px] tracking-[0.15em] uppercase text-[#C8A96E] font-semibold mb-2">For Him</p>
          <ul className="space-y-1.5">
            {combo.forHim.map((item) => (
              <li key={item} className="flex items-center gap-2 text-[#7A6050] text-xs">
                <span className="w-1 h-1 rounded-full bg-[#C8A96E] shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9px] tracking-[0.15em] uppercase text-[#C8A96E] font-semibold mb-2">For Her</p>
          <ul className="space-y-1.5">
            {combo.forHer.map((item) => (
              <li key={item} className="flex items-center gap-2 text-[#7A6050] text-xs">
                <span className="w-1 h-1 rounded-full bg-[#C8A96E] shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex items-end justify-between border-t border-[#E8D9C0] pt-3">
        <div>
          {combo.totalValue && (
            <p className="text-[#B8A088] text-xs line-through mb-0.5">Total Value ₹{combo.totalValue.toLocaleString("en-IN")}+</p>
          )}
          <p className="text-[#8B5A2B] font-bold text-xl">₹{combo.price.toLocaleString("en-IN")}</p>
        </div>
        {combo.save ? (
          <span className="text-[#8B5A2B] text-xs italic font-semibold">Save ₹{combo.save.toLocaleString("en-IN")}</span>
        ) : (
          <span className="text-[#8B5A2B] text-xs italic font-semibold">Save Big Today</span>
        )}
      </div>
      <BookNowButton service={combo.name} price={combo.price} size="lg" />
    </motion.div>
  );
}

function WhyCard({ point, index }: { point: WhyPoint; index: number }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const { icon: Icon, title, desc } = point;
  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      transition={{ delay: (index % 4) * 0.08 }}
      className="group bg-white rounded-2xl border border-[#E8D9C0] p-6 hover:border-[#C8A96E]/60 hover:shadow-[0_12px_50px_rgba(200,169,110,0.12)] transition-all duration-500 flex gap-4"
    >
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#C8A96E]/20 to-[#8B5A2B]/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300">
        <Icon size={20} className="text-[#8B5A2B]" />
      </div>
      <div>
        <h4 className="font-serif text-base font-bold text-[#2C1810] mb-1.5">{title}</h4>
        <p className="text-[#7A6050] text-sm leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

function PremiumBanner() {
  const badges: PremiumBadge[] = [
    { icon: Shield, text: "Sterilized Tools" },
    { icon: Award, text: "L'Oreal & Wella Certified" },
    { icon: CheckCircle, text: "Patch Test Guaranteed" },
    { icon: Sparkles, text: "Premium Products Only" },
    { icon: Heart, text: "No Hidden Charges" },
    { icon: Clock, text: "On-Time Appointments" },
  ];
  return (
    <div className="bg-[#F5EFE6] border-y border-[#E8D9C0] py-5 mb-16 overflow-hidden">
      <div className="flex gap-10 animate-marquee whitespace-nowrap">
        {[...badges, ...badges].map((b, i) => {
          const Icon = b.icon;
          return (
            <span key={i} className="inline-flex items-center gap-2.5 text-[#8B5A2B] text-xs tracking-widest uppercase font-semibold shrink-0">
              <Icon size={13} className="text-[#C8A96E]" />
              {b.text}
              <span className="text-[#C8A96E]/40 ml-4">✦</span>
            </span>
          );
        })}
      </div>
      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 22s linear infinite; }
      `}</style>
    </div>
  );
}

// ─── SEO ────────────────────────────────────────────────────────────────────

function ServicesSEO() {
  const SITE_URL = "https://www.velvetluxurysalon.in"; // update to your real domain
  const pageUrl = `${SITE_URL}/services`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    "name": "Velvet Premium Unisex Salon",
    "image": `${SITE_URL}/og-image.jpg`,
    "url": SITE_URL,
    "telephone": "+919345678646",
    "priceRange": "₹₹",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Lakshmi Nagar",
      "addressLocality": "Bhavani, Erode District",
      "addressRegion": "Tamil Nadu",
      "addressCountry": "IN",
    },
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Salon Services",
      "itemListElement": ALL_SERVICES_FOR_SEO.map((s) => ({
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": s.name,
        },
        "price": s.price,
        "priceCurrency": "INR",
      })),
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": "Services", "item": pageUrl },
    ],
  };

  return (
    <Helmet>
      <title>Salon Services & Price List | Velvet Premium Unisex Salon, Bhavani Erode</title>
      <meta
        name="description"
        content="Explore Velvet Premium Unisex Salon's full price list — haircuts, colouring, hair spa, facials, waxing, bridal makeup & signature combos in Bhavani, Erode. Book your appointment in seconds."
      />
      <meta
        name="keywords"
        content="unisex salon Erode, salon price list Bhavani, hair spa Erode, bridal makeup Bhavani, hair colouring salon, facial spa Erode, Velvet salon services"
      />
      <link rel="canonical" href={pageUrl} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content="Salon Services & Price List | Velvet Premium Unisex Salon" />
      <meta
        property="og:description"
        content="Full service menu with transparent pricing — haircuts, colour, hair spa, facials, waxing, bridal packages & combos."
      />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:image" content={`${SITE_URL}/og-image.jpg`} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Salon Services & Price List | Velvet Premium Unisex Salon" />
      <meta
        name="twitter:description"
        content="Explore our full menu of grooming, hair, skin and bridal services with transparent pricing."
      />

      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
    </Helmet>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function Services() {
  // "her" → show only Women's Services, "him" → show only Men's Services,
  // null (normal visit) → show both, same as before.
  const [genderFilter, setGenderFilter] = useState<"her" | "him" | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(GENDER_FILTER_KEY);
    if (stored === "her" || stored === "him") {
      setGenderFilter(stored);
    }
    localStorage.removeItem(GENDER_FILTER_KEY);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF7F2] pt-20">
      <ServicesSEO />

      {/* Hero */}
      <section className="py-16 md:py-24 px-6 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-3"
        >
          Our Offerings
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="font-serif text-4xl md:text-6xl font-bold text-[#2C1810] mb-5"
        >
          Curated Services
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-[#7A6050] text-base md:text-lg max-w-xl mx-auto leading-relaxed"
        >
          Every treatment is delivered with premium products, sterilized tools, and a team trained to bring out the best in you.
        </motion.p>
      </section>

      {/* Marquee Banner */}
      <PremiumBanner />

      {/* Service Sections */}
      <div className="max-w-5xl mx-auto px-6 pb-16">

               {/* ── MEN'S SERVICES ── */}
        {genderFilter !== "her" && (
          <>
            <div className="mb-4">
              <p className="text-xs tracking-[0.3em] uppercase text-[#8B5A2B] font-bold mb-1">— Men&apos;s Services —</p>
            </div>
            <AccordionSection eyebrow="For Him" title="Hair & Grooming" subtitle="Cuts, beard styling & global colour" services={menHairGrooming} />
            <AccordionSection eyebrow="For Him" title="Massage Services" subtitle="Head, shoulder, neck & full body relaxation" services={menMassageServices} />
            <AccordionSection eyebrow="For Him" title="Hair Treatments" subtitle="Signature conditioning, colour & smoothing — premium international formulations" services={menHairTreatments} defaultOpen={false} />
            <AccordionSection eyebrow="For Him" title="Facial Collection" subtitle="From herbal cleanups to 24 Carat Gold Facials" services={menFacialCollection} defaultOpen={false} />
            <AccordionSection eyebrow="For Him" title="Signature Grooming Packages" subtitle="Reserved for the VELVET gentleman, booked by appointment" services={menGroomingPackages} defaultOpen={false} />
          </>
        )}

        {/* ── WOMEN'S SERVICES ── */}
        {genderFilter !== "him" && (
          <>
            <div className="mb-4 mt-4">
              <p className="text-xs tracking-[0.3em] uppercase text-[#8B5A2B] font-bold mb-1">— Women&apos;s Services —</p>
            </div>
            <AccordionSection eyebrow="For Her" title="Threading" subtitle="Eyebrow, upper lip, chin & full face" services={womenThreading} />
            <AccordionSection eyebrow="For Her" title="Hair Cuts" subtitle="From baby cuts to fully customized styles" services={womenHairCuts} />
            <AccordionSection eyebrow="For Her" title="Hair Styling" subtitle="Wash, blow dry & ironing" services={womenHairStyling} defaultOpen={false} />
            <AccordionSection eyebrow="For Her" title="Hair Treatments" subtitle="Nourishing spa & scalp therapies" services={womenHairTreatments} defaultOpen={false} />
            <AccordionSection eyebrow="For Her" title="Advanced Hair Services" subtitle="Signature chemical & smoothing services by our senior stylists" services={womenAdvancedHairServices} defaultOpen={false} />
            <AccordionSection eyebrow="For Her" title="Waxing" subtitle="Regular waxing across all areas" services={womenWaxing} defaultOpen={false} />
            <AccordionSection eyebrow="For Her" title="Bleach" subtitle="From neck bleach to full body bleach" services={womenBleach} defaultOpen={false} />
            <AccordionSection eyebrow="For Her" title="Facial Collection" subtitle="From herbal cleanups to 24 Carat Gold Facials" services={womenFacialCollection} defaultOpen={false} />
            <AccordionSection eyebrow="For Her" title="Manicure & Pedicure" subtitle="Classic and spa treatments" services={womenManicurePedicure} defaultOpen={false} />
          </>
        )}

        {/* Signature Bridal Experience */}
        <section className="mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-2xl border border-[#E8D9C0] p-8 md:p-12 text-center"
          >
            <Crown size={28} className="text-[#C8A96E] mx-auto mb-3" />
            <p className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-2">The VELVET Signature</p>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2C1810] mb-3">{bridalExperience.name}</h2>
            <p className="text-[#8B5A2B] font-bold text-3xl mb-1">₹{bridalExperience.price.toLocaleString("en-IN")}</p>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#9A7A60] font-semibold mb-6">All-Inclusive Bridal Journey</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto mb-6">
              {bridalExperience.items.map((item) => (
                <span key={item} className="text-xs px-3 py-1.5 rounded-full bg-[#F5EFE6] text-[#8B5A2B] border border-[#C8A96E]/25">
                  ✦ {item}
                </span>
              ))}
            </div>
            <p className="text-[#9A7A60] text-xs italic mb-4">Reserved exclusively for VELVET brides — booked by appointment, with a complimentary pre-bridal consultation.</p>
            <div className="max-w-xs mx-auto">
              <BookNowButton service={bridalExperience.name} price={bridalExperience.price} size="lg" />
            </div>
          </motion.div>
        </section>

        {/* Signature Combos */}
        <section className="mt-4 mb-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-10">
            <p className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-2">Best Value</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810] mb-3">Signature Combos</h2>
            <p className="text-[#7A6050] text-sm md:text-base max-w-xl mx-auto leading-relaxed">Handpicked bundles that deliver more for less — no compromise on quality.</p>
          </motion.div>

          <div className="mb-10">
            <p className="text-[10px] tracking-[0.25em] uppercase text-[#C8A96E] font-semibold mb-4">Men&apos;s Combo Offers</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5">
              {menCombos.map((c, i) => <ComboCard key={c.name} combo={c} index={i} />)}
            </div>
          </div>

          <div className="mb-10">
            <p className="text-[10px] tracking-[0.25em] uppercase text-[#C8A96E] font-semibold mb-4">Women&apos;s Combo Offers</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5">
              {womenCombos.map((c, i) => <ComboCard key={c.name} combo={c} index={i} />)}
            </div>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-[#C8A96E] font-semibold mb-4 flex items-center gap-2">
              <Users size={13} className="text-[#C8A96E]" /> Couple Combo Offers
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {coupleCombos.map((c, i) => <CoupleComboCard key={c.name} combo={c} index={i} />)}
            </div>
          </div>
        </section>

        {/* Why Choose Velvet */}
        <section className="mb-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-10">
            <p className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-2">Why Velvet</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810] mb-3">The Velvet Promise</h2>
            <p className="text-[#7A6050] text-sm md:text-base max-w-xl mx-auto leading-relaxed">We don&apos;t just style you — we commit to standards that make every visit worth it.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {whyChoosePoints.map((p, i) => <WhyCard key={p.title} point={p} index={i} />)}
          </div>
        </section>

        {/* Premium Products */}
        <section className="mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-2xl border border-[#E8D9C0] p-8 md:p-12"
          >
            <div className="text-center mb-10">
              <p className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-2">Our Standard</p>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2C1810] mb-3">Premium Products. No Exceptions.</h2>
              <p className="text-[#7A6050] text-sm max-w-lg mx-auto leading-relaxed">
                Every product in our salon is sourced from globally certified brands. We never substitute with unbranded alternatives — your hair and skin deserve the best.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {(
                [
                  {
                    brand: "L'Oreal Professionnel",
                    desc: "Used for our hair spas, colour treatments, detox, and anti-dandruff services. Salon-exclusive range not available in retail stores.",
                    tags: ["Hair Spa", "Colouring", "Detox", "Anti Dandruff"],
                  },
                  {
                    brand: "Wella System Professional",
                    desc: "Our Wella Hair Spa uses the complete Wella SP system — a professional-grade nourishment protocol for deeply damaged or chemically treated hair.",
                    tags: ["Hair Spa", "Strengthening", "Scalp Care"],
                  },
                  {
                    brand: "Advanced Smoothing Systems",
                    desc: "Our Keratin, Hair Botox, and Nano Plastia services use dermatologist-recommended formulations trusted by salons across India.",
                    tags: ["Smoothing", "Straightening", "Anti-Frizz"],
                  },
                ] as ProductBrand[]
              ).map((p) => (
                <div key={p.brand} className="border border-[#E8D9C0] rounded-xl p-5 hover:border-[#C8A96E]/60 transition-colors">
                  <h4 className="font-serif text-base font-bold text-[#8B5A2B] mb-2">{p.brand}</h4>
                  <p className="text-[#7A6050] text-xs leading-relaxed mb-4">{p.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <span key={t} className="text-[9px] tracking-wider uppercase font-semibold px-2 py-1 rounded-full bg-[#C8A96E]/10 text-[#8B5A2B] border border-[#C8A96E]/25">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Hygiene & Safety */}
        <section className="mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-[#F5EFE6] rounded-2xl border border-[#E8D9C0] p-8 md:p-12"
          >
            <div className="text-center mb-10">
              <Shield size={28} className="text-[#C8A96E] mx-auto mb-3" />
              <p className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-2">Non-Negotiable</p>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2C1810] mb-3">Hygiene & Safety Standards</h2>
              <p className="text-[#7A6050] text-sm max-w-lg mx-auto leading-relaxed">
                At Velvet, cleanliness is not a checklist — it&apos;s a culture. Every single visit, without fail.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(
                [
                  { title: "Tool Sterilization", detail: "All scissors, combs, and metal tools are autoclave-sterilized or disinfected with hospital-grade solution between each client." },
                  { title: "Single-Use Applicators", detail: "Wax sticks, sponges, disposable gloves, and cotton — used once, discarded immediately. Never reused." },
                  { title: "Fresh Linen Every Time", detail: "Towels and neck strips are laundered between each appointment. Disposable alternatives available on request." },
                  { title: "Patch Test Protocol", detail: "All chemical services — colour, bleach, smoothening — begin with a mandatory patch test. No exceptions." },
                  { title: "Ammonia-Free Options", detail: "Sensitive clients can request ammonia-free colouring and chemical services across all applicable treatments." },
                  { title: "Clean Stations Always", detail: "Each styling station is sanitized after every client. Shared surfaces, door handles, and seating areas are wiped regularly." },
                ] as HygieneItem[]
              ).map((s, i) => (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="flex gap-3 p-4 rounded-xl bg-white border border-[#E8D9C0]"
                >
                  <CheckCircle size={16} className="text-[#C8A96E] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#2C1810] text-sm font-semibold mb-1">{s.title}</p>
                    <p className="text-[#7A6050] text-xs leading-relaxed">{s.detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      </div>

      {/* Bottom CTA */}
      <section className="py-16 bg-[#F5EFE6]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Crown size={28} className="text-[#C8A96E] mx-auto mb-4" />
          <h2 className="font-serif text-3xl md:text-4xl text-[#2C1810] font-bold mb-3">
            Need something bespoke?
          </h2>
          <p className="text-[#7A6050] text-sm md:text-base mb-8">
            Our concierge team is on hand to craft any experience you can imagine.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white font-semibold text-sm tracking-widest uppercase hover:scale-105 hover:shadow-lg transition-all duration-300"
          >
            Contact Concierge
          </a>
        </div>
      </section>
    </div>
  );
}