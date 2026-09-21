import { Product, UsageEntry } from '../models/inventory.model.js';
import { SERVICE_INVENTORY_MAP } from '../config/serviceInventoryMap.js';
import { IBillItem } from '../models/bill.model.js';

export interface DeductionResult {
  productName: string;
  deducted:    number;
  skipped:     boolean;
  reason?:     string;
}

export const deductInventoryForBill = async (
  items:      IBillItem[],
  billNumber: string,
  billDate:   string,
): Promise<DeductionResult[]> => {
  const results: DeductionResult[] = [];

  // Aggregate consumables across all bill items so one product
  // isn't written N times (e.g. 2× Hair Cut → 2 Neck Strips, one entry)
  const aggregated = new Map<string, { quantity: number; unit: string }>();

  for (const item of items) {
    const consumables = SERVICE_INVENTORY_MAP[item.serviceId] ?? [];
    for (const c of consumables) {
      const prev = aggregated.get(c.productName);
      if (prev) {
        prev.quantity += c.quantity;
      } else {
        aggregated.set(c.productName, { quantity: c.quantity, unit: c.unit });
      }
    }
  }

  if (aggregated.size === 0) return results;

  await Promise.all(
    Array.from(aggregated.entries()).map(async ([productName, { quantity, unit }]) => {
      try {
        const product = await Product.findOne({
          name: { $regex: `^${productName}$`, $options: 'i' },
        });

        if (!product) {
          results.push({ productName, deducted: 0, skipped: true, reason: 'product not found in inventory' });
          console.warn(`[inventory] product not found: "${productName}"`);
          return;
        }

        if (product.currentStock <= 0) {
          results.push({ productName, deducted: 0, skipped: true, reason: 'out of stock' });
          console.warn(`[inventory] out of stock: "${productName}"`);
          return;
        }

        const actualDeduction  = Math.min(quantity, product.currentStock);
        product.currentStock   = Math.max(0, product.currentStock - quantity);
        await product.save();

        await UsageEntry.create({
          productId:  product._id,
          quantity:   actualDeduction,
          reason:     'service',
          serviceRef: billNumber,
          date:       billDate,
          notes:      `Auto-deducted via bill ${billNumber} (${unit})`,
        });

        results.push({ productName, deducted: actualDeduction, skipped: false });
      } catch (err) {
        results.push({ productName, deducted: 0, skipped: true, reason: (err as Error).message });
        console.error(`[inventory] deduction failed for "${productName}":`, err);
      }
    })
  );

  return results;
};