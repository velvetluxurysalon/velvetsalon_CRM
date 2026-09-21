export type Page = "home" | "services" | "gallery" | "membership" | "franchise" | "contact";

export const SERVICES = [
  {
    category: "Hair & Colour",
    icon: "✦",
    color: "#b8860b",
    bg: "#fefce8",
    items: [
      { name: "Haircut & Styling", desc: "Precision cut tailored to your face shape and lifestyle", price: "₹499", duration: "45 min" },
      { name: "Global Colour", desc: "Full head colour using Wella Professionals", price: "₹1,499", duration: "2 hrs" },
      { name: "Highlights / Balayage", desc: "Hand-painted dimensional colour for a sun-kissed look", price: "₹2,499", duration: "3 hrs" },
      { name: "Keratin Treatment", desc: "Smoothing treatment for frizz-free, glossy hair", price: "₹3,999", duration: "2.5 hrs" },
      { name: "Hair Spa", desc: "Deep conditioning with steam therapy", price: "₹799", duration: "1 hr" },
    ],
  },
  {
    category: "Beard & Grooming",
    icon: "◈",
    color: "#374151",
    bg: "#f3f4f6",
    items: [
      { name: "Classic Shave", desc: "Traditional hot-towel straight-razor shave", price: "₹299", duration: "30 min" },
      { name: "Beard Trim & Shape", desc: "Expert sculpting for a sharp, defined beard", price: "₹199", duration: "20 min" },
      { name: "De-tan & Cleanup", desc: "Brightening treatment for men's skin", price: "₹599", duration: "45 min" },
    ],
  },
  {
    category: "Skin & Facial",
    icon: "◉",
    color: "#0369a1",
    bg: "#e0f2fe",
    items: [
      { name: "Classic Facial", desc: "Deep cleanse, exfoliate, and hydrate", price: "₹999", duration: "1 hr" },
      { name: "Gold Facial", desc: "Luxury anti-aging treatment with 24K gold", price: "₹1,799", duration: "1.5 hrs" },
      { name: "Fruit Facial", desc: "Brightening & glow-boosting with fruit enzymes", price: "₹1,299", duration: "1 hr" },
      { name: "Eyebrow Threading", desc: "Precise shaping for defined brows", price: "₹79", duration: "10 min" },
    ],
  },
  {
    category: "Nail & Spa",
    icon: "◆",
    color: "#be185d",
    bg: "#fdf2f8",
    items: [
      { name: "Classic Manicure", desc: "Shape, buff, and polish your nails", price: "₹399", duration: "30 min" },
      { name: "Gel Manicure", desc: "Long-lasting gel polish with UV cure", price: "₹699", duration: "45 min" },
      { name: "Pedicure", desc: "Foot soak, scrub, and nail care", price: "₹499", duration: "45 min" },
      { name: "Spa Pedicure", desc: "Deluxe treatment with paraffin wax", price: "₹899", duration: "1 hr" },
    ],
  },
];

export const STAFF = [
  {
    name: "Meena R.",
    role: "Senior Hair Stylist",
    specialty: "Hair & Colour",
    exp: "8 years",
    bio: "Meena specialises in balayage and colour correction. Trained with L'Oréal Paris and Wella Professionals.",
    initials: "MR",
    color: "#d4af37",
    rating: 4.9,
    reviews: 312,
  },
  {
    name: "Arjun K.",
    role: "Grooming Specialist",
    specialty: "Beard & Grooming",
    exp: "5 years",
    bio: "Arjun is a master of precision cuts and traditional hot-towel shaves. Known for his eye for detail.",
    initials: "AK",
    color: "#b8860b",
    rating: 4.8,
    reviews: 218,
  },
  {
    name: "Divya S.",
    role: "Skin Therapist",
    specialty: "Skin & Facial",
    exp: "6 years",
    bio: "Divya holds certifications in advanced skincare and facials. She creates customised treatment plans for every client.",
    initials: "DS",
    color: "#8a7050",
    rating: 4.9,
    reviews: 275,
  },
  {
    name: "Sruthi P.",
    role: "Nail Artist",
    specialty: "Nail & Spa",
    exp: "4 years",
    bio: "Sruthi is a certified nail technician and nail art enthusiast. She brings creativity and precision to every appointment.",
    initials: "SP",
    color: "#6b5740",
    rating: 4.7,
    reviews: 189,
  },
];

export const GALLERY_ITEMS = [
  { label: "Balayage",      category: "Hair",     span: "wide",   bg: "linear-gradient(135deg,#f5e6c8 0%,#e8d5a3 100%)", symbol: "✦" },
  { label: "Bridal Updo",   category: "Hair",     span: "tall",   bg: "linear-gradient(135deg,#f0e8d8 0%,#ddd0b8 100%)", symbol: "◎" },
  { label: "Classic Shave", category: "Grooming", span: "normal", bg: "linear-gradient(135deg,#e8e8e8 0%,#d0d0d0 100%)", symbol: "◈" },
  { label: "Gold Facial",   category: "Skin",     span: "normal", bg: "linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)", symbol: "◉" },
  { label: "Gel Nails",     category: "Nails",    span: "wide",   bg: "linear-gradient(135deg,#fce7f3 0%,#fbcfe8 100%)", symbol: "◆" },
  { label: "Highlight",     category: "Hair",     span: "normal", bg: "linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)", symbol: "✦" },
  { label: "Beard Art",     category: "Grooming", span: "tall",   bg: "linear-gradient(135deg,#f3f4f6 0%,#e5e7eb 100%)", symbol: "◈" },
  { label: "Brightening",   category: "Skin",     span: "normal", bg: "linear-gradient(135deg,#e0f2fe 0%,#bae6fd 100%)", symbol: "◉" },
];

export const NAV_LINKS: { id: Page; label: string }[] = [
  { id: "home",       label: "Home" },
  { id: "services",   label: "Services" },
  { id: "gallery",    label: "Gallery" },
  { id: "membership", label: "Membership" },
  { id: "franchise",  label: "Franchise" },
  { id: "contact",    label: "Contact" },
];