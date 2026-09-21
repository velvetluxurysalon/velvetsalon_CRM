// ─── Shared Service Catalogue ────────────────────────────────────────────────
// Single source of truth for every bookable/billable service at Velvet.
// Used by: Billingpage.tsx (billing + inventory deduction) and
//          ContactPage.tsx (booking form + customer portal).
//
// If you add/edit a service, do it HERE ONLY — both pages read from this file.

export interface ServiceCatalogue {
  id: string;
  name: string;
  price: number;
  duration: number;
  category: string;
}

export interface ServiceConsumable {
  productName: string;
  quantity: number;
  unit: string;
}

// ─── Service → Inventory map ─────────────────────────────────────────────────
// NOTE: The new service list did not specify consumables, so all entries
// default to an empty array. Add inventory mappings here as needed.
export const SERVICE_INVENTORY_MAP: Record<string, ServiceConsumable[]> = {
  // Signature Combos
  "combo-men-executive-grooming": [],
  "combo-men-premium-gentleman": [],
  "combo-men-luxury-transformation": [],
  "combo-men-wedding-groom": [],
  "combo-women-glow-express": [],
  "combo-women-velvet-beauty": [],
  "combo-women-premium-glow": [],
  "combo-women-bridal-prep": [],
  "combo-couple-date-night": [],
  "combo-couple-spa-retreat": [],
  "combo-couple-king-queen": [],

  // Men's Hair & Grooming
  "mhg-head-shave": [],
  "mhg-kids-hair-cut": [],
  "mhg-beard-trim-shape": [],
  "mhg-hair-cut": [],
  "mhg-hair-cut-beard-combo": [],
  "mhg-hair-colour-global": [],

  // Men's Massage Services
  "mms-head-massage": [],
  "mms-head-shoulder-massage": [],
  "mms-back-neck-massage": [],
  "mms-full-body-massage": [],

  // Men's Hair Treatments
  "mht-coconut-hot-oil-massage": [],
  "mht-hair-spa-basic": [],
  "mht-hot-oil-massage": [],
  "mht-aroma-oil-therapy": [],
  "mht-herbal-hot-oil-massage": [],
  "mht-anti-dandruff-treatment": [],
  "mht-scalp-detox-therapy": [],
  "mht-hair-spa-deep-conditioning": [],
  "mht-hair-fall-control-treatment": [],
  "mht-hair-colouring-global": [],
  "mht-hair-highlighting": [],
  "mht-keratin-treatment": [],
  "mht-hair-smoothening": [],
  "mht-permanent-hair-straightening": [],
  "mht-hair-botox-treatment": [],
  "mht-nano-plastia": [],

  // Men's Facial Collection
  "mfc-cleanup-basic": [],
  "mfc-fruit-facial": [],
  "mfc-glow-facial": [],
  "mfc-papaya-facial": [],
  "mfc-pearl-facial": [],
  "mfc-tan-removing-facial": [],
  "mfc-herbal-facial-dermamask": [],
  "mfc-skin-whitening-facial": [],
  "mfc-deep-whitening-facial": [],
  "mfc-green-tea-facial": [],
  "mfc-gold-facial": [],
  "mfc-normal-facial-deep-whitening-mask": [],
  "mfc-anti-ageing-facial": [],
  "mfc-aroma-facial": [],
  "mfc-chocolate-facial": [],
  "mfc-wine-facial": [],
  "mfc-diamond-facial": [],
  "mfc-24-carat-gold-facial": [],

  // Men's Grooming Packages
  "mgp-express-grooming": [],
  "mgp-premium-grooming": [],

  // Women's Threading
  "wth-upper-lip-threading": [],
  "wth-eyebrow-threading": [],
  "wth-chin-threading": [],
  "wth-full-face-threading": [],

  // Women's Hair Cuts
  "whc-baby-cut": [],
  "whc-straight-cut": [],
  "whc-u-cut": [],
  "whc-v-cut": [],
  "whc-layer-cut": [],
  "whc-step-cut": [],
  "whc-feather-cut": [],
  "whc-butterfly-cut": [],
  "whc-customized-hair-cut": [],

  // Women's Hair Styling
  "whs-hair-wash-blow-dry": [],
  "whs-hair-ironing": [],
  "whs-hair-styling": [],

  // Women's Hair Treatments
  "wht-coconut-hot-oil-massage": [],
  "wht-hot-oil-massage": [],
  "wht-aroma-oil-therapy": [],
  "wht-hair-spa-basic": [],
  "wht-herbal-hot-oil-massage": [],
  "wht-anti-dandruff-treatment": [],
  "wht-scalp-detox-therapy": [],
  "wht-hair-fall-control-treatment": [],
  "wht-hair-spa-deep-conditioning": [],

  // Women's Advanced Hair Services
  "wah-global-hair-colour": [],
  "wah-hair-highlighting": [],
  "wah-keratin-treatment": [],
  "wah-hair-smoothening": [],
  "wah-permanent-hair-straightening": [],
  "wah-hair-botox-treatment": [],
  "wah-nano-plastia": [],

  // Women's Waxing
  "wwx-underarm-waxing": [],
  "wwx-half-arms-waxing": [],
  "wwx-half-legs-waxing": [],
  "wwx-full-arms-waxing": [],
  "wwx-full-legs-waxing": [],
  "wwx-full-body-waxing": [],

  // Women's Bleach
  "wbl-neck-bleach": [],
  "wbl-underarm-bleach": [],
  "wbl-half-hand-bleach": [],
  "wbl-gold-bleach": [],
  "wbl-oxy-bleach": [],
  "wbl-fruit-bleach": [],
  "wbl-full-hand-bleach": [],
  "wbl-diamond-bleach": [],
  "wbl-charcoal-bleach": [],
  "wbl-full-body-bleach": [],

  // Women's Facial Collection
  "wfc-cleanup-basic": [],
  "wfc-de-tan": [],
  "wfc-fruit-facial": [],
  "wfc-glow-facial": [],
  "wfc-papaya-facial": [],
  "wfc-pearl-facial": [],
  "wfc-tan-removing-facial": [],
  "wfc-herbal-facial-dermamask": [],
  "wfc-skin-whitening-facial": [],
  "wfc-deep-whitening-facial": [],
  "wfc-green-tea-facial": [],
  "wfc-gold-facial": [],
  "wfc-normal-facial-deep-whitening-mask": [],
  "wfc-anti-ageing-facial": [],
  "wfc-aroma-facial": [],
  "wfc-chocolate-facial": [],
  "wfc-wine-facial": [],
  "wfc-diamond-facial": [],
  "wfc-24-carat-gold-facial": [],

  // Women's Manicure & Pedicure
  "wmp-classic-manicure": [],
  "wmp-classic-pedicure": [],
  "wmp-spa-manicure": [],
  "wmp-spa-pedicure": [],

  // Bridal
  "bridal-signature-experience": [],
};

// ─── Full Service Catalogue ──────────────────────────────────────────────────
export const SERVICES_CAT: ServiceCatalogue[] = [
  // Signature Combos
  { id:"combo-men-executive-grooming",   name:"Executive Grooming Combo",      price:449,   duration:60,  category:"Signature Combos" },
  { id:"combo-men-premium-gentleman",    name:"Premium Gentleman Combo",       price:599,   duration:75,  category:"Signature Combos" },
  { id:"combo-men-luxury-transformation",name:"Luxury Transformation Combo",   price:1099,  duration:105, category:"Signature Combos" },
  { id:"combo-men-wedding-groom",        name:"Wedding Groom Combo",           price:1499,  duration:120, category:"Signature Combos" },
  { id:"combo-women-glow-express",       name:"Glow Express Combo",            price:599,   duration:60,  category:"Signature Combos" },
  { id:"combo-women-velvet-beauty",      name:"VELVET Beauty Combo",           price:1299,  duration:90,  category:"Signature Combos" },
  { id:"combo-women-premium-glow",       name:"Premium Glow Combo",            price:1699,  duration:105, category:"Signature Combos" },
  { id:"combo-women-bridal-prep",        name:"Bridal Prep Combo",             price:2499,  duration:120, category:"Signature Combos" },
  { id:"combo-couple-date-night",        name:"Date Night Combo",              price:899,   duration:90,  category:"Signature Combos" },
  { id:"combo-couple-spa-retreat",       name:"Couple Spa Retreat",            price:1999,  duration:120, category:"Signature Combos" },
  { id:"combo-couple-king-queen",        name:"King & Queen Package",          price:2999,  duration:150, category:"Signature Combos" },

  // Men's Hair & Grooming
  { id:"mhg-head-shave",                 name:"Head Shave",                    price:99,    duration:20,  category:"Men's Hair & Grooming" },
  { id:"mhg-kids-hair-cut",              name:"Kids Hair Cut",                 price:149,   duration:20,  category:"Men's Hair & Grooming" },
  { id:"mhg-beard-trim-shape",           name:"Beard Trim & Shape",            price:149,   duration:15,  category:"Men's Hair & Grooming" },
  { id:"mhg-hair-cut",                   name:"Hair Cut",                      price:199,   duration:30,  category:"Men's Hair & Grooming" },
  { id:"mhg-hair-cut-beard-combo",       name:"Hair Cut + Beard Combo",        price:299,   duration:40,  category:"Men's Hair & Grooming" },
  { id:"mhg-hair-colour-global",         name:"Hair Colour (Global)",          price:399,   duration:60,  category:"Men's Hair & Grooming" },

  // Men's Massage Services
  { id:"mms-head-massage",               name:"Head Massage",                  price:199,   duration:20,  category:"Men's Massage Services" },
  { id:"mms-head-shoulder-massage",      name:"Head & Shoulder Massage",       price:299,   duration:30,  category:"Men's Massage Services" },
  { id:"mms-back-neck-massage",          name:"Back & Neck Massage",           price:449,   duration:35,  category:"Men's Massage Services" },
  { id:"mms-full-body-massage",          name:"Full Body Massage",             price:999,   duration:60,  category:"Men's Massage Services" },

  // Men's Hair Treatments
  { id:"mht-coconut-hot-oil-massage",    name:"Coconut Hot Oil Massage",       price:449,   duration:30,  category:"Men's Hair Treatments" },
  { id:"mht-hair-spa-basic",             name:"Hair Spa Basic",                price:499,   duration:45,  category:"Men's Hair Treatments" },
  { id:"mht-hot-oil-massage",            name:"Hot Oil Massage",               price:599,   duration:30,  category:"Men's Hair Treatments" },
  { id:"mht-aroma-oil-therapy",          name:"Aroma Oil Therapy",             price:599,   duration:30,  category:"Men's Hair Treatments" },
  { id:"mht-herbal-hot-oil-massage",     name:"Herbal Hot Oil Massage",        price:699,   duration:35,  category:"Men's Hair Treatments" },
  { id:"mht-anti-dandruff-treatment",    name:"Anti-Dandruff Treatment",       price:699,   duration:45,  category:"Men's Hair Treatments" },
  { id:"mht-scalp-detox-therapy",        name:"Scalp Detox Therapy",           price:749,   duration:45,  category:"Men's Hair Treatments" },
  { id:"mht-hair-spa-deep-conditioning", name:"Hair Spa Deep Conditioning",    price:799,   duration:60,  category:"Men's Hair Treatments" },
  { id:"mht-hair-fall-control-treatment",name:"Hair Fall Control Treatment",   price:899,   duration:60,  category:"Men's Hair Treatments" },
  { id:"mht-hair-colouring-global",      name:"Hair Colouring Global",         price:1399,  duration:90,  category:"Men's Hair Treatments" },
  { id:"mht-hair-highlighting",          name:"Hair Highlighting",             price:1599,  duration:90,  category:"Men's Hair Treatments" },
  { id:"mht-keratin-treatment",          name:"Keratin Treatment",             price:3499,  duration:150, category:"Men's Hair Treatments" },
  { id:"mht-hair-smoothening",           name:"Hair Smoothening",              price:3499,  duration:150, category:"Men's Hair Treatments" },
  { id:"mht-permanent-hair-straightening",name:"Permanent Hair Straightening", price:3499,  duration:150, category:"Men's Hair Treatments" },
  { id:"mht-hair-botox-treatment",       name:"Hair Botox Treatment",          price:5999,  duration:180, category:"Men's Hair Treatments" },
  { id:"mht-nano-plastia",               name:"Nano Plastia",                  price:7999,  duration:180, category:"Men's Hair Treatments" },

  // Men's Facial Collection
  { id:"mfc-cleanup-basic",              name:"Cleanup Basic",                 price:399,   duration:30,  category:"Men's Facial Collection" },
  { id:"mfc-fruit-facial",               name:"Fruit Facial",                  price:699,   duration:45,  category:"Men's Facial Collection" },
  { id:"mfc-glow-facial",                name:"Glow Facial",                   price:799,   duration:45,  category:"Men's Facial Collection" },
  { id:"mfc-papaya-facial",              name:"Papaya Facial",                 price:799,   duration:45,  category:"Men's Facial Collection" },
  { id:"mfc-pearl-facial",               name:"Pearl Facial",                  price:799,   duration:45,  category:"Men's Facial Collection" },
  { id:"mfc-tan-removing-facial",        name:"Tan Removing Facial",           price:899,   duration:45,  category:"Men's Facial Collection" },
  { id:"mfc-herbal-facial-dermamask",    name:"Herbal Facial + Dermamask",     price:899,   duration:50,  category:"Men's Facial Collection" },
  { id:"mfc-skin-whitening-facial",      name:"Skin Whitening Facial",         price:899,   duration:50,  category:"Men's Facial Collection" },
  { id:"mfc-deep-whitening-facial",      name:"Deep Whitening Facial",         price:899,   duration:50,  category:"Men's Facial Collection" },
  { id:"mfc-green-tea-facial",           name:"Green Tea Facial",              price:1149,  duration:60,  category:"Men's Facial Collection" },
  { id:"mfc-gold-facial",                name:"Gold Facial",                   price:1149,  duration:60,  category:"Men's Facial Collection" },
  { id:"mfc-normal-facial-deep-whitening-mask", name:"Normal Facial + Deep Whitening Mask", price:1149, duration:60, category:"Men's Facial Collection" },
  { id:"mfc-anti-ageing-facial",         name:"Anti Ageing Facial",            price:1299,  duration:60,  category:"Men's Facial Collection" },
  { id:"mfc-aroma-facial",               name:"Aroma Facial",                  price:1399,  duration:60,  category:"Men's Facial Collection" },
  { id:"mfc-chocolate-facial",           name:"Chocolate Facial",              price:1399,  duration:60,  category:"Men's Facial Collection" },
  { id:"mfc-wine-facial",                name:"Wine Facial",                   price:1399,  duration:60,  category:"Men's Facial Collection" },
  { id:"mfc-diamond-facial",             name:"Diamond Facial",                price:1499,  duration:75,  category:"Men's Facial Collection" },
  { id:"mfc-24-carat-gold-facial",       name:"24 Carat Gold Facial",          price:1499,  duration:75,  category:"Men's Facial Collection" },

  // Men's Grooming Packages
  { id:"mgp-express-grooming",           name:"Express Grooming",              price:349,   duration:45,  category:"Men's Grooming Packages" },
  { id:"mgp-premium-grooming",           name:"Premium Grooming",              price:699,   duration:75,  category:"Men's Grooming Packages" },

  // Women's Threading
  { id:"wth-upper-lip-threading",        name:"Upper Lip Threading",           price:39,    duration:10,  category:"Women's Threading" },
  { id:"wth-eyebrow-threading",          name:"Eyebrow Threading",             price:49,    duration:10,  category:"Women's Threading" },
  { id:"wth-chin-threading",             name:"Chin Threading",                price:49,    duration:10,  category:"Women's Threading" },
  { id:"wth-full-face-threading",        name:"Full Face Threading",           price:139,   duration:25,  category:"Women's Threading" },

  // Women's Hair Cuts
  { id:"whc-baby-cut",                   name:"Baby Cut",                      price:249,   duration:20,  category:"Women's Hair Cuts" },
  { id:"whc-straight-cut",               name:"Straight Cut",                  price:299,   duration:30,  category:"Women's Hair Cuts" },
  { id:"whc-u-cut",                      name:"U Cut",                         price:349,   duration:30,  category:"Women's Hair Cuts" },
  { id:"whc-v-cut",                      name:"V Cut",                         price:349,   duration:30,  category:"Women's Hair Cuts" },
  { id:"whc-layer-cut",                  name:"Layer Cut",                     price:799,   duration:45,  category:"Women's Hair Cuts" },
  { id:"whc-step-cut",                   name:"Step Cut",                      price:799,   duration:45,  category:"Women's Hair Cuts" },
  { id:"whc-feather-cut",                name:"Feather Cut",                   price:799,   duration:45,  category:"Women's Hair Cuts" },
  { id:"whc-butterfly-cut",              name:"Butterfly Cut",                 price:799,   duration:45,  category:"Women's Hair Cuts" },
  { id:"whc-customized-hair-cut",        name:"Customized Hair Cut",           price:1199,  duration:60,  category:"Women's Hair Cuts" },

  // Women's Hair Styling
  { id:"whs-hair-wash-blow-dry",         name:"Hair Wash & Blow Dry",          price:249,   duration:30,  category:"Women's Hair Styling" },
  { id:"whs-hair-ironing",               name:"Hair Ironing",                  price:499,   duration:40,  category:"Women's Hair Styling" },
  { id:"whs-hair-styling",               name:"Hair Styling",                  price:599,   duration:45,  category:"Women's Hair Styling" },

  // Women's Hair Treatments
  { id:"wht-coconut-hot-oil-massage",    name:"Coconut Hot Oil Massage",       price:459,   duration:30,  category:"Women's Hair Treatments" },
  { id:"wht-hot-oil-massage",            name:"Hot Oil Massage",               price:579,   duration:30,  category:"Women's Hair Treatments" },
  { id:"wht-aroma-oil-therapy",          name:"Aroma Oil Therapy",             price:579,   duration:30,  category:"Women's Hair Treatments" },
  { id:"wht-hair-spa-basic",             name:"Hair Spa Basic",                price:699,   duration:45,  category:"Women's Hair Treatments" },
  { id:"wht-herbal-hot-oil-massage",     name:"Herbal Hot Oil Massage",        price:699,   duration:35,  category:"Women's Hair Treatments" },
  { id:"wht-anti-dandruff-treatment",    name:"Anti-Dandruff Treatment",       price:699,   duration:45,  category:"Women's Hair Treatments" },
  { id:"wht-scalp-detox-therapy",        name:"Scalp Detox Therapy",           price:749,   duration:45,  category:"Women's Hair Treatments" },
  { id:"wht-hair-fall-control-treatment",name:"Hair Fall Control Treatment",   price:919,   duration:60,  category:"Women's Hair Treatments" },
  { id:"wht-hair-spa-deep-conditioning", name:"Hair Spa Deep Conditioning",    price:1199,  duration:60,  category:"Women's Hair Treatments" },

  // Women's Advanced Hair Services
  { id:"wah-global-hair-colour",         name:"Global Hair Colour",            price:1379,  duration:90,  category:"Women's Advanced Hair Services" },
  { id:"wah-hair-highlighting",          name:"Hair Highlighting",             price:1599,  duration:90,  category:"Women's Advanced Hair Services" },
  { id:"wah-keratin-treatment",          name:"Keratin Treatment",             price:3449,  duration:150, category:"Women's Advanced Hair Services" },
  { id:"wah-hair-smoothening",           name:"Hair Smoothening",              price:3449,  duration:150, category:"Women's Advanced Hair Services" },
  { id:"wah-permanent-hair-straightening", name:"Permanent Hair Straightening", price:3449, duration:150, category:"Women's Advanced Hair Services" },
  { id:"wah-hair-botox-treatment",       name:"Hair Botox Treatment",          price:5749,  duration:180, category:"Women's Advanced Hair Services" },
  { id:"wah-nano-plastia",               name:"Nano Plastia",                  price:7999,  duration:180, category:"Women's Advanced Hair Services" },

  // Women's Waxing
  { id:"wwx-underarm-waxing",            name:"Underarm Waxing",               price:119,   duration:10,  category:"Women's Waxing" },
  { id:"wwx-half-arms-waxing",           name:"Half Arms Waxing",              price:249,   duration:20,  category:"Women's Waxing" },
  { id:"wwx-half-legs-waxing",           name:"Half Legs Waxing",              price:329,   duration:25,  category:"Women's Waxing" },
  { id:"wwx-full-arms-waxing",           name:"Full Arms Waxing",              price:399,   duration:30,  category:"Women's Waxing" },
  { id:"wwx-full-legs-waxing",           name:"Full Legs Waxing",              price:519,   duration:40,  category:"Women's Waxing" },
  { id:"wwx-full-body-waxing",           name:"Full Body Waxing",              price:1379,  duration:90,  category:"Women's Waxing" },

  // Women's Bleach
  { id:"wbl-neck-bleach",                name:"Neck Bleach",                   price:229,   duration:15,  category:"Women's Bleach" },
  { id:"wbl-underarm-bleach",            name:"Underarm Bleach",               price:229,   duration:15,  category:"Women's Bleach" },
  { id:"wbl-half-hand-bleach",           name:"Half Hand Bleach",              price:229,   duration:15,  category:"Women's Bleach" },
  { id:"wbl-gold-bleach",                name:"Gold Bleach",                   price:349,   duration:20,  category:"Women's Bleach" },
  { id:"wbl-oxy-bleach",                 name:"Oxy Bleach",                    price:349,   duration:20,  category:"Women's Bleach" },
  { id:"wbl-fruit-bleach",               name:"Fruit Bleach",                  price:349,   duration:20,  category:"Women's Bleach" },
  { id:"wbl-full-hand-bleach",           name:"Full Hand Bleach",              price:459,   duration:25,  category:"Women's Bleach" },
  { id:"wbl-diamond-bleach",             name:"Diamond Bleach",                price:579,   duration:30,  category:"Women's Bleach" },
  { id:"wbl-charcoal-bleach",            name:"Charcoal Bleach",               price:579,   duration:30,  category:"Women's Bleach" },
  { id:"wbl-full-body-bleach",           name:"Full Body Bleach",              price:1729,  duration:75,  category:"Women's Bleach" },

  // Women's Facial Collection
  { id:"wfc-cleanup-basic",              name:"Cleanup Basic",                 price:399,   duration:30,  category:"Women's Facial Collection" },
  { id:"wfc-de-tan",                     name:"De-Tan",                        price:399,   duration:30,  category:"Women's Facial Collection" },
  { id:"wfc-fruit-facial",               name:"Fruit Facial",                  price:699,   duration:45,  category:"Women's Facial Collection" },
  { id:"wfc-glow-facial",                name:"Glow Facial",                   price:799,   duration:45,  category:"Women's Facial Collection" },
  { id:"wfc-papaya-facial",              name:"Papaya Facial",                 price:799,   duration:45,  category:"Women's Facial Collection" },
  { id:"wfc-pearl-facial",               name:"Pearl Facial",                  price:799,   duration:45,  category:"Women's Facial Collection" },
  { id:"wfc-tan-removing-facial",        name:"Tan Removing Facial",           price:919,   duration:50,  category:"Women's Facial Collection" },
  { id:"wfc-herbal-facial-dermamask",    name:"Herbal Facial + Dermamask",     price:919,   duration:50,  category:"Women's Facial Collection" },
  { id:"wfc-skin-whitening-facial",      name:"Skin Whitening Facial",         price:919,   duration:50,  category:"Women's Facial Collection" },
  { id:"wfc-deep-whitening-facial",      name:"Deep Whitening Facial",         price:919,   duration:50,  category:"Women's Facial Collection" },
  { id:"wfc-green-tea-facial",           name:"Green Tea Facial",              price:1149,  duration:60,  category:"Women's Facial Collection" },
  { id:"wfc-gold-facial",                name:"Gold Facial",                   price:1149,  duration:60,  category:"Women's Facial Collection" },
  { id:"wfc-normal-facial-deep-whitening-mask", name:"Normal Facial + Deep Whitening Mask", price:1149, duration:60, category:"Women's Facial Collection" },
  { id:"wfc-anti-ageing-facial",         name:"Anti Ageing Facial",            price:1269,  duration:60,  category:"Women's Facial Collection" },
  { id:"wfc-aroma-facial",               name:"Aroma Facial",                  price:1379,  duration:60,  category:"Women's Facial Collection" },
  { id:"wfc-chocolate-facial",           name:"Chocolate Facial",              price:1379,  duration:60,  category:"Women's Facial Collection" },
  { id:"wfc-wine-facial",                name:"Wine Facial",                   price:1379,  duration:60,  category:"Women's Facial Collection" },
  { id:"wfc-diamond-facial",             name:"Diamond Facial",                price:1499,  duration:75,  category:"Women's Facial Collection" },
  { id:"wfc-24-carat-gold-facial",       name:"24 Carat Gold Facial",          price:1499,  duration:75,  category:"Women's Facial Collection" },

  // Women's Manicure & Pedicure
  { id:"wmp-classic-manicure",           name:"Classic Manicure",              price:349,   duration:40,  category:"Women's Manicure & Pedicure" },
  { id:"wmp-classic-pedicure",           name:"Classic Pedicure",              price:459,   duration:45,  category:"Women's Manicure & Pedicure" },
  { id:"wmp-spa-manicure",               name:"Spa Manicure",                  price:629,   duration:50,  category:"Women's Manicure & Pedicure" },
  { id:"wmp-spa-pedicure",               name:"Spa Pedicure",                  price:799,   duration:60,  category:"Women's Manicure & Pedicure" },

  // Bridal
  { id:"bridal-signature-experience",    name:"Signature Bridal Experience",   price:29999, duration:240, category:"Bridal & Makeup" },
];

export const SERVICE_CATEGORIES = [
  "Signature Combos",
  "Men's Hair & Grooming",
  "Men's Massage Services",
  "Men's Hair Treatments",
  "Men's Facial Collection",
  "Men's Grooming Packages",
  "Women's Threading",
  "Women's Hair Cuts",
  "Women's Hair Styling",
  "Women's Hair Treatments",
  "Women's Advanced Hair Services",
  "Women's Waxing",
  "Women's Bleach",
  "Women's Facial Collection",
  "Women's Manicure & Pedicure",
  "Bridal & Makeup",
];