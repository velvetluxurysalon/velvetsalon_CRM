export interface ServiceConsumable {
  productName: string;
  quantity:    number;
  unit:        string;
}

// Keys match serviceId values in SERVICES_CAT on the frontend.
// productName must exactly match Product.name in MongoDB (case-insensitive lookup).
export const SERVICE_INVENTORY_MAP: Record<string, ServiceConsumable[]> = {
  s1:  [{ productName: 'Disposable Neck Strips', quantity: 1,  unit: 'pcs' }],
  s2:  [
    { productName: 'Wella Professionals Koleston Perfect', quantity: 60, unit: 'ml' },
    { productName: 'Disposable Neck Strips',               quantity: 1,  unit: 'pcs' },
  ],
  s3:  [
    { productName: "L'Oréal Professionnel Série Expert",   quantity: 50, unit: 'ml' },
    { productName: 'Disposable Neck Strips',               quantity: 1,  unit: 'pcs' },
  ],
  s4:  [
    { productName: 'Kerastase Nutritive Masquintense',     quantity: 30, unit: 'ml' },
    { productName: "L'Oréal Professionnel Série Expert",   quantity: 30, unit: 'ml' },
    { productName: 'Disposable Neck Strips',               quantity: 1,  unit: 'pcs' },
  ],
  s5:  [{ productName: 'Disposable Neck Strips', quantity: 1, unit: 'pcs' }],
  s6:  [{ productName: 'Disposable Neck Strips', quantity: 1, unit: 'pcs' }],
  s7:  [{ productName: 'Dermalogica Special Cleansing Gel', quantity: 10, unit: 'ml' }],
  s8:  [],
  s9:  [{ productName: 'OPI Nail Lacquer Assorted', quantity: 1, unit: 'pcs' }],
  s10: [{ productName: 'OPI Nail Lacquer Assorted', quantity: 1, unit: 'pcs' }],
  s11: [],
  s12: [],
};