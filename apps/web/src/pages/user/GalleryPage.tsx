import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import {
  Crown,
  MoveHorizontal,
  X,
  Sparkles,
  Camera,
  Video,
  Play,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ─── YOUR PHOTOS ────────────────────────────────────────────────────────────
// These live in the public/ folder, so they're referenced directly by path —
// no import needed for files in public/.
const gallery1 = "./assets/award-1.webp";
const gallery2 = "./assets/award-2.webp";

// ─── Types ───────────────────────────────────────────────────────────────
interface BeforeAfterSet {
  id: string;
  title: string;
  before: string;
  after: string;
}

interface SalonMoment {
  id: string;
  src: string;
  caption: string;
}

interface SalonVideo {
  id: string;
  src: string;
  title: string;
}

type TabName = "All" | "Before & After" | "Videos" | "Salon Moments";

// ─── DATA ───────────────────────────────────────────────────────────────────

// Replace these placeholder before/after pairs with your real transformation
// photos. If you add new images to public/, reference them the same way
// (e.g. "/before-1.webp"). If you put them in src/assets instead, import
// them as ES modules at the top of the file.
// Replace these with your real client transformation photos. If you add
// images to public/, reference them by path (e.g. "/before-1.webp"). If you
// put them in src/assets instead, import them as ES modules at the top of
// the file.
const beforeAfterSets: BeforeAfterSet[] = [
  {
    id: "ba-1",
    title: "",
    before: "./assets/beforeafter/b1.webp",
    after: "./assets/beforeafter/a1.webp",
  },
  {
    id: "ba-2",
    title: "",
    before: "./assets/beforeafter/b2.webp",
    after: "./assets/beforeafter/a2.webp",
  },
  {
    id: "ba-3",
    title: "",
    before: "./assets/beforeafter/a3.webp",
    after: "./assets/beforeafter/b3.webp",
  },
];

const salonMoments: SalonMoment[] = [
  {
    id: "moment-1",
    src: gallery1,
    caption: "Celebrating our team with the Velvet family",
  },
  {
    id: "moment-2",
    src: gallery2,
    caption: "Keerthiya receiving the Best Management Award",
  },
];

// Cloudinary video links. Change the titles to whatever you like.
const salonVideos: SalonVideo[] = [
  {
    id: "video-1",
    src: "https://res.cloudinary.com/elzwbzdn/video/upload/v1790758113/Hair_wash_video.mp4",
    title: "Hair Wash Experience",
  },
  {
    id: "video-2",
    src: "https://res.cloudinary.com/elzwbzdn/video/upload/v1790758201/IMG_3051.mov",
    title: "Salon Video 2",
  },
  {
    id: "video-3",
    src: "https://res.cloudinary.com/elzwbzdn/video/upload/v1790758269/IMG_3374.mov",
    title: "Salon Video 3",
  },
  {
    id: "video-4",
    src: "https://res.cloudinary.com/elzwbzdn/video/upload/v1790758334/IMG_3375.mov",
    title: "Salon Video 4",
  },
  {
    id: "video-5",
    src: "https://res.cloudinary.com/elzwbzdn/video/upload/v1790758415/IMG_3738.mov",
    title: "Salon Video 5",
  },
  {
    id: "video-6",
    src: "https://res.cloudinary.com/elzwbzdn/video/upload/v1790758570/IMG_3742.mov",
    title: "Salon Video 6",
  },
  {
    id: "video-7",
    src: "https://res.cloudinary.com/elzwbzdn/video/upload/v1790758704/video_20260802_154949.mp4",
    title: "Salon Video 7",
  },
  {
    id: "video-8",
    src: "https://res.cloudinary.com/elzwbzdn/video/upload/v1790758788/InShot_20260721_002724055.mp4",
    title: "Salon Video 8",
  },
  {
    id: "video-9",
    src: "https://res.cloudinary.com/elzwbzdn/video/upload/v1790759452/InShot_20260721_005754039.mp4",
    title: "Salon Video 9",
  },
];

const TABS: TabName[] = ["All", "Before & After", "Videos", "Salon Moments"];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

// ─── CLOUDINARY HELPERS ─────────────────────────────────────────────────────
// iPhone .mov files (HEVC) don't play in many browsers. Cloudinary can convert
// on the fly: we ask for H.264 MP4, and also build a thumbnail image.

const toPlayableMp4 = (url: string): string =>
  url
    .replace("/upload/", "/upload/f_mp4,vc_h264,q_auto/")
    .replace(/\.(mov|mp4)$/i, ".mp4");

// Thumbnail frame taken 1 second in (avoids black first frames)
const toThumb = (url: string): string =>
  url
    .replace("/upload/", "/upload/so_1,w_300,q_auto/")
    .replace(/\.(mov|mp4)$/i, ".jpg");

// ─── BEFORE / AFTER SLIDER ──────────────────────────────────────────────────

interface BeforeAfterSliderProps {
  before: string;
  after: string;
  title: string;
}

function BeforeAfterSlider({ before, after, title }: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePosition = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));
    setPosition(pct);
  };

  const start = () => { dragging.current = true; };
  const stop = () => { dragging.current = false; };
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragging.current) updatePosition(e.clientX);
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dragging.current && e.touches[0]) updatePosition(e.touches[0].clientX);
  };

  return (
    <div>
      <div
        ref={containerRef}
        className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden select-none cursor-ew-resize border border-[#E8D9C0] bg-[#F5EFE6]"
        onMouseDown={start}
        onMouseUp={stop}
        onMouseLeave={stop}
        onMouseMove={onMouseMove}
        onTouchStart={start}
        onTouchEnd={stop}
        onTouchMove={onTouchMove}
      >
        {/* After image (full, base layer) */}
        <img
          src={after}
          alt={`${title} — after result at Velvet Premium Unisex Salon`}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
          loading="lazy"
        />

        {/* Before image (clipped on top) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${String(100 - position)}% 0 0)` }}
        >
          <img
            src={before}
            alt={`${title} — before treatment at Velvet Premium Unisex Salon`}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
            loading="lazy"
          />
        </div>

        {/* Divider handle */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md"
          style={{ left: `${String(position)}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center">
            <MoveHorizontal size={16} className="text-[#8B5A2B]" />
          </div>
        </div>

        {/* Labels */}
        <span className="absolute bottom-3 left-3 text-[10px] uppercase tracking-wider font-semibold bg-black/50 text-white px-2.5 py-1 rounded-full pointer-events-none">
          Before
        </span>
        <span className="absolute bottom-3 right-3 text-[10px] uppercase tracking-wider font-semibold bg-black/50 text-white px-2.5 py-1 rounded-full pointer-events-none">
          After
        </span>
      </div>
      <p className="text-center text-[#5A4535] text-sm font-medium mt-3">{title}</p>
    </div>
  );
}

// ─── VIDEO CAROUSEL ─────────────────────────────────────────────────────────

interface VideoGridProps {
  items: SalonVideo[];
}

function VideoGrid({ items }: VideoGridProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const firstCard = el.firstElementChild as HTMLElement | null;
    const step = firstCard ? firstCard.offsetWidth + 16 : 240;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div>
      {/* Scrolling row of video cards */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-6 px-[15%] sm:px-6 scroll-px-[15%] sm:scroll-px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
      
        {items.map((item, i) => {
          const isPlaying = item.id === playingId;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 4) * 0.06 }}
                          className="snap-center sm:snap-start shrink-0 w-[70%] sm:w-[220px]"
            >
              <div className="relative aspect-[9/16] rounded-3xl overflow-hidden bg-black border border-[#E8D9C0] shadow-[0_12px_30px_-12px_rgba(139,90,43,0.4)]">
                {isPlaying ? (
                  <video
                    className="absolute inset-0 w-full h-full object-cover"
                    controls
                    autoPlay
                    playsInline
                    onEnded={() => { setPlayingId(null); }}
                  >
                    <source src={toPlayableMp4(item.src)} type="video/mp4" />
                    <source src={item.src} />
                  </video>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setPlayingId(item.id); }}
                    aria-label={`Play ${item.title}`}
                    className="group absolute inset-0 w-full h-full"
                  >
                    <img
                      src={toThumb(item.src)}
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
                    <span className="absolute top-3 left-3 text-[10px] font-semibold tracking-wider bg-black/50 text-white px-2.5 py-1 rounded-full">
                      {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-14 h-14 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
                        <Play size={20} fill="currentColor" className="ml-0.5" />
                      </span>
                    </span>
                    <span className="absolute bottom-4 left-4 right-4 text-left text-white text-sm font-medium">
                      {item.title}
                    </span>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Arrows */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <button
          type="button"
          onClick={() => { scrollByCard(-1); }}
          aria-label="Previous videos"
          className="w-10 h-10 rounded-full bg-white border border-[#E8D9C0] text-[#8B5A2B] flex items-center justify-center hover:border-[#C8A96E] hover:shadow-md transition-all duration-200"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-[10px] tracking-[0.25em] uppercase text-[#8B5A2B] font-semibold">
          Swipe for more
        </p>
        <button
          type="button"
          onClick={() => { scrollByCard(1); }}
          aria-label="Next videos"
          className="w-10 h-10 rounded-full bg-white border border-[#E8D9C0] text-[#8B5A2B] flex items-center justify-center hover:border-[#C8A96E] hover:shadow-md transition-all duration-200"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

// ─── SALON MOMENTS GRID + LIGHTBOX ──────────────────────────────────────────

interface SalonMomentsGridProps {
  items: SalonMoment[];
  onOpen: (item: SalonMoment) => void;
}

function SalonMomentsGrid({ items, onOpen }: SalonMomentsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {items.map((item, i) => (
        <motion.button
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08 }}
          onClick={() => { onOpen(item); }}
          className="group relative rounded-2xl overflow-hidden border border-[#E8D9C0] text-left"
        >
          <img
            src={item.src}
            alt={item.caption}
            className="w-full h-72 object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <p className="absolute bottom-4 left-4 right-4 text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {item.caption}
          </p>
        </motion.button>
      ))}
    </div>
  );
}

interface LightboxProps {
  item: SalonMoment | null;
  onClose: () => void;
}

function Lightbox({ item, onClose }: LightboxProps) {
  if (!item) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => { e.stopPropagation(); }}
          className="relative max-w-2xl w-full"
        >
          <img
            src={item.src}
            alt={item.caption}
            className="w-full max-h-[80vh] object-contain rounded-2xl"
            loading="lazy"
          />
          <p className="text-white text-center text-sm mt-4">{item.caption}</p>
          <button
            onClick={onClose}
            className="absolute -top-4 -right-4 w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-lg"
            aria-label="Close"
          >
            <X size={16} className="text-[#2C1810]" />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── SEO ────────────────────────────────────────────────────────────────────

function GallerySEO() {
  const SITE_URL = "https://www.velvetluxurysalon.com"; // update to your real domain
  const pageUrl = `${SITE_URL}/gallery`;

  const allImages = [
    ...beforeAfterSets.flatMap((s) => [
      { url: s.before, caption: `${s.title} — before` },
      { url: s.after, caption: `${s.title} — after` },
    ]),
    ...salonMoments.map((m) => ({ url: m.src, caption: m.caption })),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    "name": "Velvet Premium Unisex Salon — Gallery",
    "description":
      "Before & after hair, colour, and bridal transformations plus behind-the-scenes moments from Velvet Premium Unisex Salon, Bhavani, Erode.",
    "url": pageUrl,
    "associatedMedia": allImages.map((img) => ({
      "@type": "ImageObject",
      "contentUrl": img.url,
      "caption": img.caption,
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": "Gallery", "item": pageUrl },
    ],
  };

  return (
    <Helmet>
      <title>Gallery — Before & After Transformations | Velvet Premium Unisex Salon</title>
      <meta
        name="description"
        content="See real before & after hair colour, smoothening, and bridal makeup transformations, plus salon moments from Velvet Premium Unisex Salon in Bhavani, Erode."
      />
      <meta
        name="keywords"
        content="salon gallery Erode, before after hair colour, bridal makeup transformation, Velvet salon photos, unisex salon Bhavani gallery"
      />
      <link rel="canonical" href={pageUrl} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content="Gallery — Before & After Transformations | Velvet Premium Unisex Salon" />
      <meta
        property="og:description"
        content="Real transformations and behind-the-scenes moments from Velvet Premium Unisex Salon."
      />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:image" content={gallery1} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Gallery — Before & After Transformations | Velvet Premium Unisex Salon" />
      <meta
        name="twitter:description"
        content="Real transformations and behind-the-scenes moments from Velvet Premium Unisex Salon."
      />

      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
    </Helmet>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function Gallery() {
  const [activeTab, setActiveTab] = useState<TabName>("All");
  const [lightboxItem, setLightboxItem] = useState<SalonMoment | null>(null);

  const showBeforeAfter = activeTab === "All" || activeTab === "Before & After";
  const showVideos = activeTab === "All" || activeTab === "Videos";
  const showMoments = activeTab === "All" || activeTab === "Salon Moments";

  return (
    <div className="min-h-screen bg-[#FAF7F2] pt-20">
      <GallerySEO />

      {/* Hero */}
      <section className="py-16 md:py-24 px-6 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs tracking-[0.3em] uppercase text-[#C8A96E] font-semibold mb-3"
        >
          See The Results
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="font-serif text-4xl md:text-6xl font-bold text-[#2C1810] mb-5"
        >
          Our Gallery
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-[#7A6050] text-base md:text-lg max-w-xl mx-auto leading-relaxed"
        >
          Real transformations, real moments — drag the slider to see the difference, or browse our salon highlights.
        </motion.p>
      </section>

      {/* Tabs */}
      <div className="flex items-center justify-center gap-3 px-6 mb-12 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); }}
            className={`px-5 py-2.5 rounded-full text-xs tracking-widest uppercase font-semibold border transition-all duration-200 ${
              activeTab === tab
                ? "bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white border-transparent shadow-md"
                : "bg-white text-[#8B5A2B] border-[#E8D9C0] hover:border-[#C8A96E]/60"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-20">
        {/* Before & After */}
        {showBeforeAfter && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-20"
          >
            <div className="text-center mb-10">
              <p className="text-[10px] tracking-[0.25em] uppercase text-[#C8A96E] font-semibold mb-2 flex items-center justify-center gap-2">
                <Sparkles size={12} /> Drag To Compare
              </p>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810] mb-3">
                Before &amp; After
              </h2>
              <p className="text-[#7A6050] text-sm md:text-base max-w-xl mx-auto leading-relaxed">
                Genuine transformations from our chairs — drag the handle on each photo to reveal the result.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {beforeAfterSets.map((set) => (
                <div
                  key={set.id}
                  className="w-full max-w-[240px] mx-auto sm:max-w-none"
                >
                  <BeforeAfterSlider
                    before={set.before}
                    after={set.after}
                    title={set.title}
                  />
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Videos */}
        {showVideos && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-20"
          >
            <div className="text-center mb-10">
              <p className="text-[10px] tracking-[0.25em] uppercase text-[#C8A96E] font-semibold mb-2 flex items-center justify-center gap-2">
                <Video size={12} /> Watch Us Work
              </p>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810] mb-3">
                Salon Videos
              </h2>
              <p className="text-[#7A6050] text-sm md:text-base max-w-xl mx-auto leading-relaxed">
                Take a look at our services and the Velvet experience in action.
              </p>
            </div>

            <VideoGrid items={salonVideos} />
          </motion.section>
        )}

        {/* Salon Moments */}
        {showMoments && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <div className="text-center mb-10">
              <p className="text-[10px] tracking-[0.25em] uppercase text-[#C8A96E] font-semibold mb-2 flex items-center justify-center gap-2">
                <Camera size={12} /> Behind The Scenes
              </p>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#2C1810] mb-3">
                Salon Moments
              </h2>
              <p className="text-[#7A6050] text-sm md:text-base max-w-xl mx-auto leading-relaxed">
                A glimpse into the Velvet family — celebrations, awards, and everyday moments behind the chair.
              </p>
            </div>

            <SalonMomentsGrid items={salonMoments} onOpen={setLightboxItem} />
          </motion.section>
        )}
      </div>

      {/* Bottom CTA */}
      <section className="py-16 bg-[#F5EFE6]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Crown size={28} className="text-[#C8A96E] mx-auto mb-4" />
          <h2 className="font-serif text-3xl md:text-4xl text-[#2C1810] font-bold mb-3">
            Ready for your own transformation?
          </h2>
          <p className="text-[#7A6050] text-sm md:text-base mb-8">
            Book an appointment and let our team craft your next look.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B5A2B] text-white font-semibold text-sm tracking-widest uppercase hover:scale-105 hover:shadow-lg transition-all duration-300"
          >
            Book an Appointment
          </a>
        </div>
      </section>

      <Lightbox item={lightboxItem} onClose={() => { setLightboxItem(null); }} />
    </div>
  );
}