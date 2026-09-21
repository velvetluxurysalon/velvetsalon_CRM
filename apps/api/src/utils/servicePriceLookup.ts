/**
 * Service catalogue price lookup — mirrored from the shared catalogue
 * (db/services.ts → SERVICES_CAT). Used as a fallback when an
 * Appointment/Bill has price === 0/undefined.
 *
 * Shared by appointment.service.ts and portal.controller.ts so it's kept in
 * sync in ONE place instead of two.
 */
export const SERVICE_PRICE_LOOKUP: Record<string, number> = {
  // Signature Combos
  "Executive Grooming Combo": 449,
  "Premium Gentleman Combo": 599,
  "Luxury Transformation Combo": 1099,
  "Wedding Groom Combo": 1499,
  "Glow Express Combo": 599,
  "VELVET Beauty Combo": 1299,
  "Premium Glow Combo": 1699,
  "Bridal Prep Combo": 2499,
  "Date Night Combo": 899,
  "Couple Spa Retreat": 1999,
  "King & Queen Package": 2999,

  // Men's Hair & Grooming
  "Head Shave": 99,
  "Kids Hair Cut": 149,
  "Beard Trim & Shape": 149,
  "Hair Cut": 199,
  "Hair Cut + Beard Combo": 299,
  "Hair Colour (Global)": 399,

  // Men's Massage Services
  "Head Massage": 199,
  "Head & Shoulder Massage": 299,
  "Back & Neck Massage": 449,
  "Full Body Massage": 999,

  // Men's Hair Treatments
  "Coconut Hot Oil Massage": 449,
  "Hair Spa Basic": 499,
  "Hot Oil Massage": 599,
  "Aroma Oil Therapy": 599,
  "Herbal Hot Oil Massage": 699,
  "Anti-Dandruff Treatment": 699,
  "Scalp Detox Therapy": 749,
  "Hair Spa Deep Conditioning": 799,
  "Hair Fall Control Treatment": 899,
  "Hair Colouring Global": 1399,
  "Hair Highlighting": 1599,
  "Keratin Treatment": 3499,
  "Hair Smoothening": 3499,
  "Permanent Hair Straightening": 3499,
  "Hair Botox Treatment": 5999,
  "Nano Plastia": 7999,

  // Men's Facial Collection
  "Cleanup Basic": 399,
  "Fruit Facial": 699,
  "Glow Facial": 799,
  "Papaya Facial": 799,
  "Pearl Facial": 799,
  "Tan Removing Facial": 899,
  "Herbal Facial + Dermamask": 899,
  "Skin Whitening Facial": 899,
  "Deep Whitening Facial": 899,
  "Green Tea Facial": 1149,
  "Gold Facial": 1149,
  "Normal Facial + Deep Whitening Mask": 1149,
  "Anti Ageing Facial": 1299,
  "Aroma Facial": 1399,
  "Chocolate Facial": 1399,
  "Wine Facial": 1399,
  "Diamond Facial": 1499,
  "24 Carat Gold Facial": 1499,

  // Men's Grooming Packages
  "Express Grooming": 349,
  "Premium Grooming": 699,

  // Women's Threading
  "Upper Lip Threading": 39,
  "Eyebrow Threading": 49,
  "Chin Threading": 49,
  "Full Face Threading": 139,

  // Women's Hair Cuts
  "Baby Cut": 249,
  "Straight Cut": 299,
  "U Cut": 349,
  "V Cut": 349,
  "Layer Cut": 799,
  "Step Cut": 799,
  "Feather Cut": 799,
  "Butterfly Cut": 799,
  "Customized Hair Cut": 1199,

  // Women's Hair Styling
  "Hair Wash & Blow Dry": 249,
  "Hair Ironing": 499,
  "Hair Styling": 599,

  // Women's Hair Treatments (note: some names overlap with Men's — later entries win)
  "Global Hair Colour": 1379,

  // Women's Advanced Hair Services

  // Women's Waxing
  "Underarm Waxing": 119,
  "Half Arms Waxing": 249,
  "Half Legs Waxing": 329,
  "Full Arms Waxing": 399,
  "Full Legs Waxing": 519,
  "Full Body Waxing": 1379,

  // Women's Bleach
  "Neck Bleach": 229,
  "Underarm Bleach": 229,
  "Half Hand Bleach": 229,
  "Gold Bleach": 349,
  "Oxy Bleach": 349,
  "Fruit Bleach": 349,
  "Full Hand Bleach": 459,
  "Diamond Bleach": 579,
  "Charcoal Bleach": 579,
  "Full Body Bleach": 1729,

  // Women's Facial Collection
  "De-Tan": 399,

  // Women's Manicure & Pedicure
  "Classic Manicure": 349,
  "Classic Pedicure": 459,
  "Spa Manicure": 629,
  "Spa Pedicure": 799,

  // Bridal
  "Signature Bridal Experience": 29999,
};

/** Resolve a usable price for a service name, falling back to the catalogue above. */
export const resolveServicePrice = (
  serviceName: string | undefined,
  storedPrice: number | undefined
): number => {
  if (storedPrice && storedPrice > 0) return storedPrice;
  return SERVICE_PRICE_LOOKUP[serviceName ?? ''] ?? 0;
};