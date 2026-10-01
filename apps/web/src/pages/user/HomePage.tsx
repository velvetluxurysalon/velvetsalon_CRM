import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Page } from "./salonData";
import {
  ArrowRight,
  Star,
  Crown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  ExternalLink,
  X,
  ShieldCheck,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface HomePageProps {
  navigate: (p: Page) => void;
  setActiveCat: (i: number) => void;
}

interface HeroSlide {
  tag: string;
  headline: string;
  sub: string;
  cta: string;
  page: Page;
  badge: string;
  img: string;
}

// Shape returned by GET /api/banners (see banner.model.ts / banner.controller.ts)
interface ApiBanner {
  _id: string;
  type: "hero" | "offer" | "combo";
  title: string;
  subtitle: string;
  badge: string;
  cta: string;
  discount?: string;
  targetPage: string;
  imageUrl: string;
  status: "active" | "inactive" | "scheduled";
  startDate: string;
  endDate: string;
  order: number;
}

// Pages the public site actually has routes for — used to validate targetPage
// before trusting it as a `Page` value coming from the database.
const VALID_PAGES: Page[] = ["home", "services", "gallery", "membership", "contact"];

function isValidPage(value: string): value is Page {
  return (VALID_PAGES as string[]).includes(value);
}

function mapBannerToSlide(b: ApiBanner): HeroSlide {
  return {
    tag: b.discount ? b.discount : b.badge,
    headline: b.title,
    sub: b.subtitle,
    cta: b.cta || "Book Now",
    page: isValidPage(b.targetPage) ? b.targetPage : "contact",
    badge: b.badge,
    img: b.imageUrl,
  };
}

interface ComboOffer {
  id: string;
  title: string;
  discount?: string;
  items: string;
  img: string;
  badge: string;
}

interface GenderCollection {
  label: string;
  tag: string;
  desc: string;
  img: string;
  page: Page;
  highlights: string[];
}

interface StatItem {
  value: number;
  suffix: string;
  label: string;
}

interface GoogleReview {
  name: string;
  initial: string;
  avatar?: string;
  rating: number;
  date: string;
  text: string;
  color: string;
}

// ── Appointment alert(reuses the same customer login used on the portal) ──
const APPT_TOKEN_KEY = "velvet_customer_token";
const PORTAL_API = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/portal`;

// Tells the Services page which gender's services to show when arriving from
// a "For Her" / "For Him" card below. Services reads this once on mount and
// clears it immediately, so it never lingers or affects a normal visit.
const GENDER_FILTER_KEY = "velvet_gender_filter";

interface PortalAppointmentLite {
  _id: string;
  service: string;
  date: string;
  time: string;
  status: "confirmed" | "in-progress" | "completed" | "cancelled" | "pending" | "billed";
}

const fmtTime12 = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12)}:${String(m).padStart(2, "0")} ${ampm}`;
};

// ── Birthday / anniversary / membership-expiry wish (reuses the same
// customer login used on the portal and the appointment-alert fetch above) ──
interface PortalSessionLite {
  name: string;
  dob?: string | undefined;
  anniversary?: string | undefined;
  membershipTier: "none" | "silver" | "gold" | "platinum";
  membershipExpiry?: string | undefined;
}

interface WishInfo {
  kind: "birthday" | "anniversary" | "membership";
  name: string;
  membershipExpiry?: string | undefined;
}

const isTodayMonthDay = (dateStr?: string): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr.slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

// True if membershipExpiry falls within the next 7 days (inclusive of today).
const isMembershipExpiringSoon = (expiry?: string): boolean => {
  if (!expiry) return false;
  const exp = new Date(expiry.slice(0, 10) + "T00:00:00");
  if (isNaN(exp.getTime())) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = (exp.getTime() - now.getTime()) / 86400000;
  return diffDays >= 0 && diffDays <= 7;
};

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_TABS: { label: string; img: string }[] = [
  { label: "Hair Styling", img: "./assets/haircut.webp" },
  { label: "Facials & Skin", img: "./assets/facial.webp" },
  { label: "Body Rituals ", img: "./assets/massage.webp" },
  { label: "Bridal & Groom", img: "./assets/bridal.webp" },
];

// Static fallback — used if the API has no active hero banners yet, or the
// fetch fails (e.g. backend offline). Keeps the homepage from ever showing
// an empty carousel.
const HERO_SLIDES: HeroSlide[] = [
  {
    tag: "Men's Grooming",
    headline: "Sharp. Refined. Effortless.",
    sub: "Premium haircuts, beard sculpting & hot towel shaves by master stylists.",
    cta: "Book Now",
    page: "services",
    badge: "MEN'S SPECIAL",
    img: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1400&h=700&fit=crop&q=90",
  },
  {
    tag: "Women's Styling",
    headline: "Beauty in Every Strand",
    sub: "Cuts, colours, keratin & blowouts — your hair, elevated.",
    cta: "Explore Women's",
    page: "services",
    badge: "NEW SEASON",
    img: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1400&h=700&fit=crop&q=90",
  },
  {
    tag: "Skin & Wellness",
    headline: "Glow is Your Signature",
    sub: "Advanced facials, gold treatments & skin rituals crafted for radiance.",
    cta: "See Facials",
    page: "services",
    badge: "BESTSELLER",
    img: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1400&h=700&fit=crop&q=90",
  },
  {
    tag: "Luxury Combos",
    headline: "The Full Velvet Experience",
    sub: "Hair + Skin + Massage packages — save up to 40% with curated bundles.",
    cta: "View Packages",
    page: "membership",
    badge: "FLAT 40% OFF",
    img: "https://images.unsplash.com/photo-1559599101-f09722fb4948?w=1400&h=700&fit=crop&q=90",
  },
];

// Only two collections — Unisex Spa removed. Each card lists a curated set
// of category highlights (not every single service, since the full menu is
// large) pulled from the Services page structure.
const GENDER_COLLECTIONS: GenderCollection[] = [
  {
    label: "For Her",
    tag: "Women's Services",
    desc: "Hair, skin, nails & bridal — curated for every woman.",
    img: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&h=750&fit=crop&q=85",
    page: "services",
    highlights: [
      "Threading",
      "Hair Cuts & Styling",
      "Advanced Hair Treatments",
      "Facial Collection",
      "Waxing & Bleach",
      "Manicure & Pedicure",
      "Bridal Experience",
    ],
  },
  {
    label: "For Him",
    tag: "Men's Grooming",
    desc: "Cuts, shaves & skin rituals — the gentleman's sanctuary.",
    img: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&h=750&fit=crop&q=85",
    page: "services",
    highlights: [
      "Hair Cuts & Grooming",
      "Beard Styling",
      "Hair Treatments",
      "Facial Collection",
      "Massage Services",
      "Grooming Packages",
    ],
  },
];

// These are the SAME 4 combos defined in the Services page (menCombos,
// womenCombos, coupleCombos), not made-up placeholder data. `id` must
// exactly match slugify(combo.name) for that combo on the Services page.
//
//   Executive Grooming Combo → menCombos      (₹449, save ₹98  → 18% OFF)
//   VELVET Beauty Combo      → womenCombos    (₹1299, save ₹308 → 19% OFF)
//   Bridal Prep Combo        → womenCombos    (₹2499, save ₹1187 → 32% OFF)
//   Date Night Combo         → coupleCombos   (₹899, save ₹447 → 33% OFF)
const COMBO_OFFERS: ComboOffer[] = [
  {
    id: "executive-grooming-combo",
    title: "Executive Grooming Combo",
    items: "Hair Cut + Beard Trim & Shape + Head Massage",
    img: "./assets/home/1.webp",
    badge: "MOST BOOKED",
  },
  {
    id: "velvet-beauty-combo",
    title: "VELVET Beauty Combo",
    items: "Hair Cut + Facial + Classic Pedicure",
    img: "./assets/home/2.webp",
    badge: "CUSTOMER FAVORITE",
  },
  {
    id: "bridal-prep-combo",
    title: "Bridal Prep Combo",
    items: "Facial + Full Body Wax + Hair Spa + Pedicure",
    img: "https://images.unsplash.com/photo-1519741497674-611481863552?w=500&h=350&fit=crop&q=85",
    badge: "BRIDAL FAVORITE",
  },


  {
    id: "date-night-combo",
    title: "Date Night Combo",
    items: "For Him: Hair Cut + Beard Trim  ·  For Her: Hair Styling + Cleanup",
    img: "./assets/home/4.webp",
    badge: "PERFECT FOR COUPLES",
  },
];

// The salon's founding date— used to power the live "days & counting" stat.
// Adjust this if the actual opening date differs.
const FOUNDING_DATE = new Date("2024-03-01T00:00:00");

const STATS: StatItem[] = [
  { value: 8, suffix: "K+", label: "Happy Clients" },
  { value: 98, suffix: "%", label: "Satisfaction" },
  { value: 30, suffix: "+", label: "Services" },
];

const GOOGLE_REVIEWS: GoogleReview[] = [
  {
    name: "Shanmathi Shanmathi",
    initial: "S",
    avatar: "./assets/reviews/shanmathi.webp", // TODO: replace with real photo URL
    rating: 5,
    date: "22 hours ago",
    text: "A satisfied haircut ever, such an experienced person.",
    color: "from-[#A07840] to-[#6B4020]",
  },
  {
    name: "Pavi Thiru",
    initial: "P",
    avatar: "./assets/reviews/pavi.webp", // TODO: replace with real photo URL
    rating: 5,
    date: "23 hours ago",
    text: "Nice experience, Vasuki gives nice service and cost effective. In this salon Vasuki gives hairspa professionally.",
    color: "from-[#8B5A2B] to-[#C8A96E]",
  },
  {
    name: "Janani Satheshkumar",
    initial: "J",
    avatar: "./assets/reviews/janani.webp", // TODO: replace with real photo URL
    rating: 5,
    date: "a day ago",
    text: "Very good and effective - Vasuki did a facial very...", // ⚠️ cut off in source screenshot — send full text
    color: "from-[#C8A96E] to-[#8B5A2B]",
  },
];

const GOOGLE_URL = "https://g.page/r/CWB5ZgKh5KkEEBM/review";

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.12 } } };

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

// Computes the number of whole days since FOUNDING_DATE and keeps itself
// fresh — it recalculates on mount and then re-schedules itself for the
// next local midnight, so the counter rolls over on its own every day
// without needing a manual update.
function useDaysSinceFounding(): number {
  const [days, setDays] = useState<number>(() =>
    Math.floor((Date.now() - FOUNDING_DATE.getTime()) / 86400000)
  );

  useEffect(() => {
    const tick = () => { setDays(Math.floor((Date.now() - FOUNDING_DATE.getTime()) / 86400000)); };

    tick();

    const msUntilMidnight = new Date().setHours(24, 0, 0, 0) - Date.now();
    let dailyInterval: ReturnType<typeof setInterval> | undefined;
    const midnightTimeout = setTimeout(() => {
      tick();
      dailyInterval = setInterval(tick, 86400000);
    }, msUntilMidnight);

    return () => {
      clearTimeout(midnightTimeout);
      if (dailyInterval) clearInterval(dailyInterval);
    };
  }, []);

  return days;
}

// ─────────────────────────────────────────────────────────────────────────────
// LUCKY NUMBER — animates a number the way a lucky-draw / slot machine reel
// does: rapid random digits first, then a smooth deceleration that settles
// exactly on the target value. Only triggers once, when the element scrolls
// into view.
// ─────────────────────────────────────────────────────────────────────────────

interface LuckyNumberProps {
  value: number;
  suffix?: string;
  duration?: number;
}

function LuckyNumber({ value, suffix = "", duration = 1600 }: LuckyNumberProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.4 });
  const [display, setDisplay] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!inView || hasAnimated.current) return;
    hasAnimated.current = true;

    const spinDuration = duration * 0.55;
    const settleDuration = duration * 0.45;
    const startTime = performance.now();
    const spinCeiling = Math.max(value * 3, value + 50);

    let frameId: number;
    const tick = (now: number) => {
      const elapsed = now - startTime;

      if (elapsed < spinDuration) {
        // rapid random flicker — classic lucky-draw reel spin
        setDisplay(Math.floor(Math.random() * spinCeiling));
        frameId = requestAnimationFrame(tick);
      } else if (elapsed < spinDuration + settleDuration) {
        // ease-out count into the real value
        const progress = (elapsed - spinDuration) / settleDuration;
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(value * eased));
        frameId = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frameId); };
  }, [inView, value, duration]);

  return (
    <span ref={ref}>
      {display.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO CAROUSEL  (fetches live banners, falls back to static HERO_SLIDES)
// ─────────────────────────────────────────────────────────────────────────────

function HeroCarousel({ navigate }: { navigate: (p: Page) => void }) {
  const [slides, setSlides] = useState<HeroSlide[]>(HERO_SLIDES);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch active hero banners from the CRM on mount. If the request fails
  // or returns no active hero banners, the static fallback above stays in place.
  useEffect(() => {
    let cancelled = false;

   // A banner's `status` is set once by the admin and never auto-flips when its
// date range ends, so the public site can't trust `status=active` alone —
// we also have to check today's date against startDate/endDate here.
function isBannerCurrentlyLive(b: ApiBanner): boolean {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (b.startDate && b.startDate.slice(0, 10) > todayStr) return false;
  if (b.endDate && b.endDate.slice(0, 10) < todayStr) return false;
  return true;
}

async function loadBanners() {
      try {
        const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api/banners?type=hero&status=active`);
        if (!res.ok) return;
        const json = (await res.json()) as { data?: ApiBanner[] };
        const banners: ApiBanner[] = (json.data ?? []).filter(isBannerCurrentlyLive);

        if (!cancelled && banners.length > 0) {
          const mapped = banners.sort((a, b) => a.order - b.order).map(mapBannerToSlide);
          setSlides(mapped);
          setCurrent(0);
        }
      } catch {
        // network error / API offline — keep the static fallback slides
      }
    }

    void loadBanners();
    return () => {
      cancelled = true;
    };
  }, []);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % slides.length);
  }, [slides.length]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(next, 4800);
  }, [next]);

  useEffect(() => {
    timerRef.current = setInterval(next, 4800);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [next]);

  if (slides.length === 0) return null;

  const slide = slides[current];
  if (!slide) return null;

 return (
   <section className="relative w-full overflow-hidden mt-1 md:mt-1" style={{ height: "calc(clamp(360px,58vw,655px) + 88px)" }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.75, ease: "easeInOut" }}
          className="absolute inset-0"
        >
                    <img src={slide.img} alt={slide.headline} className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1A0A05]/85 via-[#2C1810]/50 to-transparent" />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={`txt-${String(current)}`}
          initial={{ opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 28 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 flex flex-col justify-center px-6 sm:px-12 md:px-20 lg:px-28 pb-[88px]"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white text-[10px] tracking-[0.2em] uppercase font-bold mb-3 w-fit shadow-lg">
            {slide.badge}
          </span>
          <p className="text-[#C8A96E] text-xs tracking-[0.28em] uppercase font-semibold mb-2">{slide.tag}</p>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-3 max-w-xl">
            {slide.headline}
          </h1>
          <p className="text-[#E8D9C0] text-sm md:text-base max-w-sm mb-7 leading-relaxed">{slide.sub}</p>
          <button
            onClick={() => {
              navigate(slide.page);
              resetTimer();
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white font-semibold text-sm tracking-widest uppercase border-none cursor-pointer hover:scale-105 hover:shadow-xl transition-all duration-300 w-fit"
          >
            {slide.cta} <ArrowRight size={15} />
          </button>
        </motion.div>
      </AnimatePresence>

      <button
        onClick={() => {
          prev();
          resetTimer();
        }}
        className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-[#C8A96E]/80 transition-all z-10 cursor-pointer"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={() => {
          next();
          resetTimer();
        }}
        className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-[#C8A96E]/80 transition-all z-10 cursor-pointer"
      >
        <ChevronRight size={18} />
      </button>

            <button
        onClick={() => {
          navigate("contact");
          resetTimer();
        }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-[#2C1810] font-bold text-sm tracking-widest uppercase border-none cursor-pointer shadow-xl hover:scale-105 hover:bg-[#FAF7F2] transition-all duration-300 whitespace-nowrap"
      >
        Reserve Your Spot <ArrowRight size={15} />
      </button>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setCurrent(i);
              resetTimer();
            }}
            className={`rounded-full border-none cursor-pointer transition-all duration-300 ${
              i === current ? "w-7 h-2 bg-[#C8A96E]" : "w-2 h-2 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY TABS
// ─────────────────────────────────────────────────────────────────────────────

interface CategoryTabsProps {
  onSelect: (i: number) => void;
  navigate: (p: Page) => void;
}

function CategoryTabs({ onSelect, navigate }: CategoryTabsProps) {
  const [active, setActive] = useState(0);

  const handleSelect = (i: number) => {
    setActive(i);
    onSelect(i);
    navigate("services");
  };

  return (
    <section className="bg-[#FAF7F2] pt-10 pb-6 px-6 border-b border-[#E8D9C0]">
      <div className="max-w-7xl mx-auto">
        <div className="flex gap-8 overflow-x-auto no-scrollbar pb-2 justify-start md:justify-center" style={{ scrollbarWidth: "none" }}>
          {CATEGORY_TABS.map(({ label, img }, i) => (
            <button
              key={label}
              onClick={() => { handleSelect(i); }}
              className="flex flex-col items-center gap-3 flex-shrink-0 group bg-transparent border-none cursor-pointer"
            >
              <div
                className={`w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 transition-all duration-300 ${
                  i === active
                    ? "border-[#C8A96E] shadow-[0_0_0_4px_rgba(200,169,110,0.22)]"
                    : "border-[#E8D9C0] group-hover:border-[#C8A96E]/50"
                }`}
              >
                                <img src={img} alt={label} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <span
                className={`text-sm md:text-base tracking-wide font-semibold uppercase transition-colors whitespace-nowrap ${
                  i === active ? "text-[#8B5A2B]" : "text-[#9E8572]"
                }`}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HYGIENE & CLIENT SATISFACTION
// ─────────────────────────────────────────────────────────────────────────────

const HYGIENE_POINTS = [
  {
    icon: ShieldCheck,
    title: "Sterilized Tools",
    desc: "Every tool is sanitized and sterilized after each use, following salon-grade hygiene protocols.",
  },
  {
    icon: Sparkles,
    title: "Single-Use Essentials",
    desc: "Razors, towels, and disposable kits are single-use only — never reused between clients.",
  },
  {
    icon: Users,
    title: "Trained Staff",
    desc: "Our stylists follow strict cleanliness routines, from handwashing to workstation sanitation.",
  },
  {
    icon: Star,
    title: "Premium Products",
    desc: "We use only certified, skin-safe products sourced from trusted, premium brands.",
  },
];

const SATISFACTION_STATS = [
  { value: "4.9/5", label: "Average Rating" },
  { value: "10,000+", label: "Happy Clients" },
  { value: "98%", label: "Repeat Customers" },
];

function HygieneSatisfaction() {
  return (
    <AnimatedSection className="py-14 md:py-20 px-4 max-w-7xl mx-auto">
      <motion.div variants={fadeUp} className="text-center mb-10">
        <p className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-2">
          Why Choose Us
        </p>
        <h2 className="font-serif text-3xl md:text-5xl font-bold text-[#2C1810]">
          Hygiene You Can Trust
        </h2>
        <p className="text-sm text-[#7A6050] max-w-xl mx-auto mt-3 leading-relaxed">
          Your safety and comfort come first. Here's how we maintain the highest
          standards of cleanliness at every visit.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
        {HYGIENE_POINTS.map(({ icon: Icon, title, desc }) => (
          <motion.div
            key={title}
            variants={fadeUp}
            className="group bg-white rounded-2xl p-6 border border-[#E8D9C0] hover:border-[#C8A96E]/50 hover:shadow-[0_10px_40px_rgba(200,169,110,0.14)] transition-all duration-500"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#C8A96E] to-[#8B5A2B] flex items-center justify-center shadow-md mb-4">
              <Icon size={19} className="text-white" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#2C1810] mb-1.5">{title}</h3>
            <p className="text-xs text-[#7A6050] leading-relaxed">{desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        variants={fadeUp}
        className="rounded-2xl bg-gradient-to-br from-[#2C1810] to-[#1a1208] px-6 py-10 md:py-12 text-center"
      >
        <p className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-2">
          Client Satisfaction
        </p>
        <h3 className="font-serif text-2xl md:text-3xl font-bold text-white mb-8">
          Trusted by Thousands of Happy Clients
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl mx-auto">
          {SATISFACTION_STATS.map(({ value, label }) => (
            <div key={label}>
              <p className="font-serif text-3xl md:text-4xl font-bold text-[#C8A96E] mb-1">
                {value}
              </p>
              <p className="text-[11px] tracking-[0.15em] uppercase text-white/70">
                {label}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatedSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GENDER COLLECTIONS
// ─────────────────────────────────────────────────────────────────────────────

function GenderCollections({ navigate }: { navigate: (p: Page) => void }) {
  // Stores which gender was picked, then navigates — Services reads and
  // clears this on mount to decide which section(s) to show.
  const goTo = (label: string, page: Page) => {
    localStorage.setItem(GENDER_FILTER_KEY, label === "For Her" ? "her" : "him");
    navigate(page);
  };

  return (
    <AnimatedSection className="py-10 md:py-16 px-4 max-w-5xl mx-auto">
      <motion.div variants={fadeUp} className="text-center mb-10">
        <p className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-2">Tailored For You</p>
        <h2 className="font-serif text-3xl md:text-5xl font-bold text-[#2C1810]">Browse by Category</h2>
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {GENDER_COLLECTIONS.map(({ label, tag, desc, img, page, highlights }) => (
          <motion.div
            key={label}
            variants={fadeUp}
            className="group relative rounded-2xl overflow-hidden cursor-pointer"
            style={{ height: "clamp(380px, 46vw, 560px)" }}
            onClick={() => { goTo(label, page); }}
          >
                                  <img src={img} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#2C1810]/92 via-[#2C1810]/45 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <p className="text-[#C8A96E] text-[10px] tracking-[0.22em] uppercase font-semibold mb-1">{tag}</p>
              <h3 className="font-serif text-2xl md:text-3xl font-bold text-white mb-1">{label}</h3>
              <p className="text-[#D4C4B0] text-xs mb-4 leading-relaxed">{desc}</p>

              <div className="flex flex-wrap gap-1.5 mb-5">
                {highlights.map((h) => (
                  <span key={h} className="text-[10px] px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-[#E8D9C0]">
                    {h}
                  </span>
                ))}
              </div>

                           <button
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(label, page);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white text-xs font-semibold tracking-wider uppercase border-none cursor-pointer hover:scale-105 hover:shadow-lg transition-all duration-300"
              >
                Explore <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </AnimatedSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS BAR — fully clickable (→ services). All stat numbers animate with a
// "lucky draw" style spin (rapid flicker → ease-out settle) the first time
// the section scrolls into view. Includes a live "days & counting" stat
// computed from FOUNDING_DATE, refreshing itself automatically every day at
// midnight.
// ─────────────────────────────────────────────────────────────────────────────

function StatsBar({ navigate }: { navigate: (p: Page) => void }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });
  const daysSinceFounding = useDaysSinceFounding();

  const goToServices = () => { navigate("services"); };

  return (
    <motion.section
      ref={ref}
      variants={stagger}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      onClick={goToServices}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") goToServices();
      }}
      role="button"
      tabIndex={0}
      aria-label="View all services"
      className="bg-gradient-to-r from-[#2C1810] via-[#3D2215] to-[#2C1810] py-10 cursor-pointer hover:brightness-110 transition-all duration-300"
    >
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {STATS.map(({ value, suffix, label }) => (
          <motion.div key={label} variants={fadeUp}>
            <p className="font-serif text-3xl md:text-4xl font-bold text-[#C8A96E]">
              <LuckyNumber value={value} suffix={suffix} />
            </p>
            <p className="text-xs tracking-[0.2em] uppercase text-[#A89070] mt-1">{label}</p>
          </motion.div>
        ))}
        <motion.div variants={fadeUp}>
          <p className="font-serif text-3xl md:text-4xl font-bold text-[#C8A96E]">
            <LuckyNumber value={daysSinceFounding} suffix=" days" />
          </p>
          <p className="text-xs tracking-[0.2em] uppercase text-[#A89070] mt-1">Still Counting</p>
        </motion.div>
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBO OFFERS — real combos from the Services page. Clicking "Book Package"
// navigates to Services.
// TODO: doc2's version deep-linked & auto-scrolled to the exact combo card
// via React Router state (`{ state: { scrollTo: id } }`). This app doesn't
// use React Router, so that scroll-to-combo behavior isn't wired up here —
// wire it through setActiveCat or a query param if you want it back.
// ─────────────────────────────────────────────────────────────────────────────

function ComboOffers({ navigate }: { navigate: (p: Page) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  return (
    <section className="py-14 bg-[#F5EFE6]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-1">Limited Time</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810]">Combo Packages</h2>
          </div>
          <div className="hidden md:flex gap-2">
            <button
              onClick={() => scroll(-1)}
              className="w-9 h-9 rounded-full border border-[#C8A96E]/40 flex items-center justify-center text-[#8B5A2B] hover:bg-[#C8A96E] hover:text-white transition-all bg-transparent cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scroll(1)}
              className="w-9 h-9 rounded-full border border-[#C8A96E]/40 flex items-center justify-center text-[#8B5A2B] hover:bg-[#C8A96E] hover:text-white transition-all bg-transparent cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex gap-5 overflow-x-auto no-scrollbar md:grid md:grid-cols-4 pb-2" style={{ scrollbarWidth: "none" }}>
          {COMBO_OFFERS.map(({ id, title, discount, items, img, badge }) => (
            <div
              key={id}
              className="flex-shrink-0 w-64 md:w-auto group bg-white rounded-2xl overflow-hidden border border-[#E8D9C0] hover:shadow-[0_12px_40px_rgba(200,169,110,0.16)] hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div className="relative overflow-hidden" style={{ height: "185px" }}>
                                <img src={img} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2C1810]/65 to-transparent" />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white text-[9px] font-bold tracking-widest uppercase shadow">
                  {badge}
                </span>
                {discount && (
                  <span className="absolute top-3 right-3 font-serif text-2xl font-bold text-white drop-shadow-lg">{discount}</span>
                )}
              </div>
              <div className="p-4">
                <h4 className="font-serif text-base font-bold text-[#2C1810] mb-1">{title}</h4>
                <p className="text-xs text-[#9E8572] mb-3 leading-relaxed">{items}</p>
                <button
                  onClick={() => { navigate("services"); }}
                  className="block w-full text-center py-2 rounded-full border border-[#C8A96E]/50 text-[#8B5A2B] text-xs font-semibold tracking-wider uppercase bg-transparent cursor-pointer hover:bg-gradient-to-r hover:from-[#C8A96E] hover:to-[#8B5A2B] hover:text-white hover:border-transparent transition-all duration-300"
                >
                  Book Package
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE REVIEWS
// ─────────────────────────────────────────────────────────────────────────────

function StarRating({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={size} className={s <= rating ? "text-[#FBBC04] fill-[#FBBC04]" : "text-[#D9C9B8] fill-[#D9C9B8]"} />
      ))}
    </div>
  );
}

function GoogleReviews() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
    setTimeout(checkScroll, 400);
  };

  return (
    <section className="py-16 md:py-20 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-2">Verified on Google</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810]">What Clients Are Saying</h2>
          </div>

          <a
            href={GOOGLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-[#FAF7F2] border border-[#E8D9C0] rounded-2xl px-5 py-3 hover:border-[#C8A96E]/60 hover:shadow-md transition-all group shrink-0 w-fit"
          >
            <svg width="28" height="28" viewBox="0 0 48 48" className="shrink-0">
              <path fill="#4285F4" d="M44.5 20H24v8h11.7C34.1 33.1 29.6 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z" />
              <path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.5 16.1 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
              <path fill="#FBBC05" d="M24 44c5.2 0 9.9-1.8 13.5-4.7l-6.3-5.2C29.3 35.6 26.8 36.5 24 36.5c-5.5 0-10.2-3.7-11.8-8.8l-6.6 5.1C9.6 39.4 16.3 44 24 44z" />
              <path fill="#EA4335" d="M44.5 20H24v8h11.7c-.8 2.3-2.3 4.2-4.2 5.6l6.3 5.2C41.5 35.5 44.5 30.2 44.5 24c0-1.3-.1-2.7-.2-4z" />
            </svg>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-xl font-bold text-[#2C1810]">4.9</span>
                <StarRating rating={5} size={14} />
              </div>
              <p className="text-[10px] text-[#9E8572] tracking-wide">86 reviews on Google</p>
            </div>
            <ExternalLink size={13} className="text-[#C8A96E] group-hover:text-[#8B5A2B] ml-1 transition-colors" />
          </a>
        </div>

        <div className="relative">
          <div className="hidden md:flex absolute -top-14 right-0 gap-2">
            <button
              onClick={() => { scroll(-1); }}
              disabled={!canScrollLeft}
              className="w-9 h-9 rounded-full border border-[#C8A96E]/40 flex items-center justify-center text-[#8B5A2B] hover:bg-[#C8A96E] hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => { scroll(1); }}
              disabled={!canScrollRight}
              className="w-9 h-9 rounded-full border border-[#C8A96E]/40 flex items-center justify-center text-[#8B5A2B] hover:bg-[#C8A96E] hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="overflow-hidden">
            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
                           {GOOGLE_REVIEWS.map(({ name, initial, avatar, rating, date, text, color }) => (
                <div
                  key={name}
                  className="flex-shrink-0 w-[85vw] sm:w-[320px] bg-[#FAF7F2] rounded-2xl p-5 border border-[#E8D9C0] hover:border-[#C8A96E]/50 hover:shadow-[0_8px_30px_rgba(200,169,110,0.12)] transition-all duration-300 snap-start"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={name}
                          loading="lazy"
                          className="w-10 h-10 rounded-full object-cover shadow-sm shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextElementSibling?.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0 ${avatar ? "hidden" : ""}`}>
                        {initial}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#2C1810] leading-tight">{name}</p>
                        <p className="text-[10px] text-[#9E8572] mt-0.5">{date}</p>
                      </div>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 48 48" className="shrink-0 mt-0.5 opacity-70">
                      <path fill="#4285F4" d="M44.5 20H24v8h11.7C34.1 33.1 29.6 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z" />
                      <path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.5 16.1 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
                      <path fill="#FBBC05" d="M24 44c5.2 0 9.9-1.8 13.5-4.7l-6.3-5.2C29.3 35.6 26.8 36.5 24 36.5c-5.5 0-10.2-3.7-11.8-8.8l-6.6 5.1C9.6 39.4 16.3 44 24 44z" />
                      <path fill="#EA4335" d="M44.5 20H24v8h11.7c-.8 2.3-2.3 4.2-4.2 5.6l6.3 5.2C41.5 35.5 44.5 30.2 44.5 24c0-1.3-.1-2.7-.2-4z" />
                    </svg>
                  </div>

                  <StarRating rating={rating} size={13} />
                  <p className="text-[#4A3728] text-xs leading-relaxed mt-3 italic line-clamp-4">&ldquo;{text}&rdquo;</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex md:hidden justify-center gap-1.5 mt-4">
            {GOOGLE_REVIEWS.map((r) => (
              <div key={r.name} className="w-1.5 h-1.5 rounded-full bg-[#C8A96E]/40" />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center mt-10">
          <a
            href={GOOGLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white text-xs font-semibold tracking-wider uppercase hover:scale-105 hover:shadow-lg transition-all duration-300"
          >
            See All Reviews on Google <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// CTA BANNER
// ─────────────────────────────────────────────────────────────────────────────

function CTABanner({ navigate }: { navigate: (p: Page) => void }) {
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
        <h2 className="font-serif text-3xl md:text-5xl text-white font-bold mb-3">Your Best Look Awaits</h2>
        <p className="text-[#A89070] text-sm md:text-base mb-8 max-w-md mx-auto leading-relaxed">
          Book your appointment today and experience the Velvet difference — luxury grooming, just for you.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            onClick={() => { navigate("contact"); }}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white font-semibold tracking-widest uppercase text-sm border-none cursor-pointer hover:scale-105 hover:shadow-xl transition-all duration-300"
          >
            Book Appointment <ArrowRight size={16} />
          </button>
          <button
            onClick={() => { navigate("membership"); }}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-[#C8A96E]/40 text-[#C8A96E] font-medium tracking-wider uppercase text-sm bg-transparent cursor-pointer hover:bg-[#C8A96E]/10 transition-all duration-300"
          >
            View Packages
          </button>
        </div>
      </div>
    </motion.section>
  );
}


// AFTER (new block — nothing to remove, this is purely additive)

function MembershipPromoModal({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 400 }}
          transition={{ duration: 0.35, ease: "easeIn" }}
          onClick={(e) => { e.stopPropagation(); }}
          className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-3xl w-full grid grid-cols-1 sm:grid-cols-2"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-[#2C1810] hover:bg-white transition-all cursor-pointer border-none"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="relative h-56 sm:h-full">
            <img src="./assets/coupan.webp" alt="Velvet Membership Card" className="w-full h-full object-cover" loading="lazy" />
          </div>

          <div className="p-7 sm:p-9 flex flex-col justify-center">
            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#2C1810] mb-3 leading-tight">
              Why Pay Full Price Every Visit?
            </h3>
            <p className="text-sm text-[#7A6050] mb-4 leading-relaxed">
              Join the VELVET Membership for only <span className="font-bold text-[#8B5A2B]">₹199</span> and enjoy:
            </p>
            <ul className="space-y-2 mb-6 text-sm text-[#4A3728]">
              <li className="flex items-start gap-2">
                <span>🌟</span> <span>10% OFF on every service</span>
              </li>
              <li className="flex items-start gap-2">
                <span>🗓️</span> <span>Valid for 365 Days</span>
              </li>
              <li className="flex items-start gap-2">
                <span>💰</span> <span>Recover your membership fee in just a few visits</span>
              </li>
            </ul>
            <p className="text-xs text-[#C8A96E] font-semibold tracking-wide mb-6">Join Today. Save Every Time.</p>

            <div className="flex items-start gap-2 bg-[#FFF4E5] border border-[#F0D9B0] rounded-xl px-4 py-3 mb-5">
              <span className="text-base leading-none">⏰</span>
              <p className="text-xs text-[#8B5A2B] font-medium leading-relaxed">
                Book your appointment now — slots filling fast!
              </p>
            </div>

            <a
              href="https://wa.me/919345678646?text=Hi%20Velvet%20Salon%2C%20I'd%20like%20to%20join%20the%20VELVET%20Membership."
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white font-semibold text-sm tracking-widest uppercase border-none cursor-pointer hover:scale-105 hover:shadow-xl transition-all duration-300 w-fit"
            >
              Join Membership <ArrowRight size={15} />
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function AppointmentAlertModal({
  appt,
  onClose,
}: {
  appt: PortalAppointmentLite;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 400 }}
          transition={{ duration: 0.35, ease: "easeIn" }}
          onClick={(e) => { e.stopPropagation(); }}
          className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-sm w-full p-7 sm:p-9 text-center"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-[#FAF7F2] flex items-center justify-center text-[#2C1810] hover:bg-[#F0E4D0] transition-all cursor-pointer border-none"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#C8A96E] to-[#8B5A2B] flex items-center justify-center mx-auto mb-4 text-2xl">
            ⏰
          </div>
          <h3 className="font-serif text-2xl font-bold text-[#2C1810] mb-2 leading-tight">
            Your appointment is coming up!
          </h3>
          <p className="text-sm text-[#7A6050] mb-1 leading-relaxed">{appt.service}</p>
          <p className="text-lg font-semibold text-[#8B5A2B] mb-6">
            Today at {fmtTime12(appt.time)}
          </p>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white font-semibold text-sm tracking-widest uppercase border-none cursor-pointer hover:scale-105 hover:shadow-xl transition-all duration-300 w-fit mx-auto"
          >
            Got It
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function WishModal({
  info,
  onClose,
}: {
  info: WishInfo;
  onClose: () => void;
}) {
  const copy =
    info.kind === "birthday"
      ? { emoji: "🎂", title: `Happy Birthday, ${info.name}!`, sub: "Wishing you a wonderful day — treat yourself to something special at Velvet." }
      : info.kind === "anniversary"
        ? { emoji: "💍", title: `Happy Anniversary, ${info.name}!`, sub: "Celebrate the occasion with a Velvet experience just for you." }
        : {
            emoji: "⏳",
            title: "Your Membership Is Expiring Soon",
            sub: info.membershipExpiry
              ? `It expires on ${new Date(info.membershipExpiry.slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} — renew to keep your discount.`
              : "Renew soon to keep enjoying your member discount.",
          };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 400 }}
          transition={{ duration: 0.35, ease: "easeIn" }}
          onClick={(e) => { e.stopPropagation(); }}
          className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-sm w-full p-7 sm:p-9 text-center"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-[#FAF7F2] flex items-center justify-center text-[#2C1810] hover:bg-[#F0E4D0] transition-all cursor-pointer border-none"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#C8A96E] to-[#8B5A2B] flex items-center justify-center mx-auto mb-4 text-2xl">
            {copy.emoji}
          </div>
          <h3 className="font-serif text-2xl font-bold text-[#2C1810] mb-2 leading-tight">
            {copy.title}
          </h3>
          <p className="text-sm text-[#7A6050] mb-6 leading-relaxed">{copy.sub}</p>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white font-semibold text-sm tracking-widest uppercase border-none cursor-pointer hover:scale-105 hover:shadow-xl transition-all duration-300 w-fit mx-auto"
          >
            {info.kind === "membership" ? "Renew Now" : "Thank You"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOME PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage({ navigate, setActiveCat }: HomePageProps) {
   const [showPromo, setShowPromo] = useState(false);
  const [upcomingAppt, setUpcomingAppt] = useState<PortalAppointmentLite | null>(null);
  const [showApptAlert, setShowApptAlert] = useState(false);
  const [wishInfo, setWishInfo] = useState<WishInfo | null>(null);
  const [showWish, setShowWish] = useState(false);

  useEffect(() => {
    // Show the membership promo every time Home mounts (including reloads).
    setShowPromo(true);
  }, []);

  // Check if the logged-in customer has an appointment starting within the
  // next 60 minutes today. Silently does nothing if not logged in or if the
  // request fails — same fallback pattern used elsewhere in this app.
  useEffect(() => {
    const token = localStorage.getItem(APPT_TOKEN_KEY);
    if (!token) return;

    const todayStr = new Date().toISOString().slice(0, 10);

    fetch(`${PORTAL_API}/appointments`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? (res.json() as Promise<PortalAppointmentLite[]>) : []))
      .then((data) => {
        const now = new Date();
        const soon = data.find((a) => {
          if (a.status !== "confirmed" && a.status !== "pending") return false;
          if (a.date.slice(0, 10) !== todayStr) return false;
          const [hh = "0", mm = "00"] = a.time.split(":");
          const apptTime = new Date(`${todayStr}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00`);
          const diffMinutes = (apptTime.getTime() - now.getTime()) / 60000;
          return diffMinutes > 0 && diffMinutes <= 60;
        });
               if (soon) setUpcomingAppt(soon);
      })
      .catch(() => { /* silent — homepage still works without this */ });
  }, []);

  // Check if the logged-in customer has a birthday, anniversary, or an
  // expiring membership to wish/remind them about. Silent no-op if not
  // logged in or the request fails — same fallback pattern as above.
  useEffect(() => {
    const token = localStorage.getItem(APPT_TOKEN_KEY);
    if (!token) return;

    fetch(`${PORTAL_API}/me`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? (res.json() as Promise<PortalSessionLite>) : null))
      .then((data) => {
        if (!data) return;
        if (isTodayMonthDay(data.dob)) {
          setWishInfo({ kind: "birthday", name: data.name });
        } else if (isTodayMonthDay(data.anniversary)) {
          setWishInfo({ kind: "anniversary", name: data.name });
        } else if (data.membershipTier !== "none" && isMembershipExpiringSoon(data.membershipExpiry)) {
          setWishInfo({ kind: "membership", name: data.name, membershipExpiry: data.membershipExpiry });
        }
      })
      .catch(() => { /* silent — homepage still works without this */ });
  }, []);

  return (
    <div className="bg-[#FAF7F2] min-h-screen overflow-hidden">
          {showPromo && (
        <MembershipPromoModal
          onClose={() => {
            setShowPromo(false);
            if (wishInfo) setShowWish(true);
            else if (upcomingAppt) setShowApptAlert(true);
          }}
        />
      )}
      {!showPromo && showWish && wishInfo && (
        <WishModal
          info={wishInfo}
          onClose={() => {
            setShowWish(false);
            if (upcomingAppt) setShowApptAlert(true);
          }}
        />
      )}
      {!showPromo && !showWish && showApptAlert && upcomingAppt && (
        <AppointmentAlertModal appt={upcomingAppt} onClose={() => { setShowApptAlert(false); }} />
      )}
      <HeroCarousel navigate={navigate} />
      <CategoryTabs onSelect={setActiveCat} navigate={navigate} />
           <GenderCollections navigate={navigate} />
      <HygieneSatisfaction />
      <StatsBar navigate={navigate} />
      <ComboOffers navigate={navigate} />
      <GoogleReviews />
      
      <CTABanner navigate={navigate} />
    </div>
  );
}