import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Crown,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Camera,
  Star,
} from "lucide-react";

// Update this to your real Instagram profile URL
const INSTAGRAM_URL = "https://www.instagram.com/velvet_unisex";

export default function Footer() {
  const SITE_URL = "https://www.velvetluxurysalon.com"; // update to your real domain

  // Ensures clicking a footer nav link always lands at the top of the new
  // page, instead of keeping the scroll position from the previous page.
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: "Velvet Premium Unisex Salon",
    url: SITE_URL,
    telephone: "+919345678646",
    email: "Velvetluxurysalon@gmail.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Opposite to ICICI bank, KK Nagar, Kalingarayanpalayam",
      addressLocality: "Bhavani, Erode",
      addressRegion: "Tamil Nadu",
      addressCountry: "IN",
    },
    sameAs: [INSTAGRAM_URL, "https://wa.me/919345678646"],
  };

  const NAV_ITEMS = ["Home", "Services", "membership-plans","franchise" ,"Gallery", "Contact"];

  const CONTACT_ITEMS = [
    {
      icon: Phone,
      label: "Call Us",
      value: "9345678646",
      href: "tel:+919345678646",
    },
    {
      icon: Mail,
      label: "Email",
      value: "support@velvetluxurysalon.in",
      href: "mailto:support@velvetluxurysalon.in",
    },
    {
      icon: Mail,
      label: "Franchise Email",
      value: "franchises@velvetluxurysalon.in ",
      href: "mailto:franchises@velvetluxurysalon.in",
    },
    {
      icon: MapPin,
      label: "Visit Us",
      value:
        "Opposite to ICICI bank, KK Nagar, Kalingarayanpalayam, Bhavani, Erode Dt, Tamil Nadu",
      href: "https://g.page/r/CWB5ZgKh5KkEEBM/review",
    },
  ];

  const CONNECT_ITEMS = [
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: "9345678646",
      href: "https://wa.me/919345678646",
    },
    {
      icon: Camera,
      label: "Instagram",
      value: "velvetluxurysalon",
      href: INSTAGRAM_URL,
    },
    {
      icon: Star,
      label: "Reviews",
      value: "Rate us on Google",
      href: "https://g.page/r/CWB5ZgKh5KkEEBM/review",
    },
    {
      icon: Star,
      label: "linkedIn",
      value: "LinkedIn",
      href: "https://www.linkedin.com/company/velvet-premium-unisex-salon/",
    },
    {
      icon: Star,
      label: "facebook",
      value: "Facebook",
      href: "https://www.facebook.com/share/19HWbeDTUu/",
    },
  ];

  return (
    <footer className="bg-[#2C1810] text-[#E8D9C0] pt-16 pb-24 md:pb-14">
      {/* Site-wide structured data — helps search engines link this site to
          your Instagram and verify your business details consistently. */}
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(organizationLd)}</script>
      </Helmet>

      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_1fr_1fr] gap-x-8 gap-y-12 pb-12 border-b border-[#C8A96E]/15">
          {/* ── Brand ── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C8A96E] to-[#8B5A2B] flex items-center justify-center shrink-0">
                <Crown size={15} className="text-white" />
              </span>
              <span className="font-serif text-2xl tracking-[0.15em] text-[#C8A96E] font-bold">
                VELVET
              </span>
            </div>
            <p className="text-sm text-[#A89070] leading-relaxed tracking-wide max-w-[280px]">
              A sanctuary of refined grooming. Experience luxury as it was
              always meant to be.
            </p>

            
          </div>

          {/* ── Navigate ── */}
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#C8A96E] font-semibold mb-5">
              Navigate
            </p>
            <nav className="flex flex-col gap-3">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item}
                  to={`/${item.toLowerCase() === "home" ? "" : item.toLowerCase()}`}
                  onClick={scrollToTop}
                  className="text-sm text-[#A89070] hover:text-[#C8A96E] transition-colors tracking-wide w-fit"
                >
                  {item === "membership-plans"
                ? "Membership"
                : item === "franchise"
                  ? "Franchise"
                  : item}
                </Link>
              ))}
            </nav>
          </div>

          {/* ── Contact ── */}
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#C8A96E] font-semibold mb-5">
              Contact Us
            </p>
            <div className="flex flex-col gap-4">
              {CONTACT_ITEMS.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="flex items-start gap-3 group"
                >
                  <div className="w-8 h-8 rounded-full border border-[#C8A96E]/25 flex items-center justify-center shrink-0 group-hover:bg-[#C8A96E] transition-all duration-300">
                    <c.icon
                      size={13}
                      className="text-[#C8A96E] group-hover:text-white transition-colors"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] tracking-wider uppercase text-[#C8A96E]/70 font-semibold">
                      {c.label}
                    </p>
                    <p className="text-sm text-[#A89070] group-hover:text-[#C8A96E] transition-colors leading-relaxed">
                      {c.value}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* ── Connect ── */}
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#C8A96E] font-semibold mb-5">
              Connect
            </p>
            <div className="flex flex-col gap-4">
              {CONNECT_ITEMS.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 group"
                >
                  <div className="w-8 h-8 rounded-full border border-[#C8A96E]/25 flex items-center justify-center shrink-0 group-hover:bg-[#C8A96E] transition-all duration-300">
                    <c.icon
                      size={13}
                      className="text-[#C8A96E] group-hover:text-white transition-colors"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] tracking-wider uppercase text-[#C8A96E]/70 font-semibold">
                      {c.label}
                    </p>
                    <p className="text-sm text-[#A89070] group-hover:text-[#C8A96E] transition-colors">
                      {c.value}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="pt-8 flex flex-col items-center gap-2">
          <p className="text-center text-xs text-[#6B5040] tracking-widest uppercase">
            © {new Date().getFullYear()} Velvet Premium Unisex Salon. All rights reserved.
          </p>
          <p className="text-center text-[10px] text-[#6B5040]/70 tracking-widest uppercase">
            Powered by <span className="text-[#C8A96E]">Letnext Technologies</span>
            &nbsp;|&nbsp; Developed By : Krishna Suthers Raj T G B
          </p>
        </div>
      </div>
    </footer>
  );
}