import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Coupon } from '../models/coupon.model.js';
import {
  CreateCouponDto, UpdateCouponDto, ValidateCouponDto,
  validateCreateCouponDto, validateValidateCouponDto,
} from '../dtos/coupon.dto.js';

const todayStr = () => new Date().toISOString().slice(0, 10);

// ─── GET /api/coupons ─────────────────────────────────────────────────────────
export const getCoupons = async (_req: Request, res: Response): Promise<void> => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch coupons', error: (err as Error).message });
  }
};

// ─── POST /api/coupons ────────────────────────────────────────────────────────
export const createCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CreateCouponDto;
    const errors = validateCreateCouponDto(body);
    if (errors.length) { res.status(400).json({ message: errors.join(', ') }); return; }

    const code = body.code.trim().toUpperCase();
    const existing = await Coupon.findOne({ code });
    if (existing) { res.status(409).json({ message: `Coupon code "${code}" already exists.` }); return; }

    const coupon = await Coupon.create({
      code,
      discountType:  body.discountType,
      discountValue: body.discountValue,
      description:   body.description ?? '',
      expiryDate:    body.expiryDate ?? null,
      active:        body.active ?? true,
      customerPhone: body.customerPhone?.trim() || null,   // ← added
    });

    res.status(201).json(coupon);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create coupon', error: (err as Error).message });
  }
};

// ─── PATCH /api/coupons/:id ───────────────────────────────────────────────────
export const updateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) { res.status(400).json({ message: 'Invalid coupon ID.' }); return; }

    const coupon = await Coupon.findById(id);
    if (!coupon) { res.status(404).json({ message: 'Coupon not found.' }); return; }

    const body = req.body as UpdateCouponDto;

    if (body.code !== undefined) {
      const code = body.code.trim().toUpperCase();
      const dup = await Coupon.findOne({ code, _id: { $ne: id } });
      if (dup) { res.status(409).json({ message: `Coupon code "${code}" already exists.` }); return; }
      coupon.code = code;
    }
    if (body.discountType  !== undefined) coupon.discountType  = body.discountType;
    if (body.discountValue !== undefined) coupon.discountValue = body.discountValue;
    if (body.description   !== undefined) coupon.description   = body.description;
    if (body.expiryDate    !== undefined) coupon.expiryDate    = body.expiryDate;
    if (body.active        !== undefined) coupon.active        = body.active;
    if (body.customerPhone !== undefined) coupon.customerPhone = body.customerPhone?.trim() || null;   // ← added

    const errors = validateCreateCouponDto({
      code: coupon.code, discountType: coupon.discountType,
      discountValue: coupon.discountValue, expiryDate: coupon.expiryDate ?? null,
    });
    if (errors.length) { res.status(400).json({ message: errors.join(', ') }); return; }

    await coupon.save();
    res.json(coupon);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update coupon', error: (err as Error).message });
  }
};

// ─── DELETE /api/coupons/:id ──────────────────────────────────────────────────
export const deleteCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) { res.status(400).json({ message: 'Invalid coupon ID.' }); return; }

    const deleted = await Coupon.findByIdAndDelete(id);
    if (!deleted) { res.status(404).json({ message: 'Coupon not found.' }); return; }

    res.json({ message: 'Coupon deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete coupon', error: (err as Error).message });
  }
};

// ─── POST /api/coupons/validate ───────────────────────────────────────────────
// Billing page calls this to preview a discount before saving. createBill()
// below calls resolveCouponDiscount() again at save time — it never trusts
// the client-computed discount amount for the actual bill record.
export const validateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as ValidateCouponDto;
    const errors = validateValidateCouponDto(body);
    if (errors.length) { res.status(400).json({ valid: false, message: errors.join(', ') }); return; }

    const result = await resolveCouponDiscount(body.code, body.amount, body.customerPhone);
    if (result.error) { res.json({ valid: false, message: result.error }); return; }

    const coupon = await Coupon.findOne({ code: result.code });
    if (!coupon) {
      res.status(404).json({ valid: false, message: 'Coupon not found.' });
      return;
    }
    res.json({
      valid: true,
      code:          result.code,
      discountType:  coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: result.discountAmount,
      description:   coupon.description,
      customerLocked: !!coupon.customerPhone,   // ← lets the UI show "Personal coupon" styling if you want
    });
  } catch (err) {
    res.status(500).json({ valid: false, message: 'Failed to validate coupon', error: (err as Error).message });
  }
  
};
// ─── Mark a coupon as redeemed ─────────────────────────────────────────────────
// Called by bill.controller.ts immediately after a bill is successfully
// saved with this coupon applied. Once set, resolveCouponDiscount() above
// will refuse to honor the code again for anyone, including the same
// customer trying to reuse it on a different bill.
export async function markCouponUsed(code: string | null): Promise<void> {
  if (!code) return;
  try {
    await Coupon.findOneAndUpdate(
      { code: code.trim().toUpperCase() },
      { usedAt: new Date(), active: false },
    );
  } catch (err) {
    console.error('[coupon] failed to mark coupon used:', err);
  }
}

// Reused by bill.controller.ts so bill creation recomputes the coupon
// discount server-side instead of trusting whatever the client sends.
// customerPhone is REQUIRED to unlock a coupon that has customerPhone set —
// pass the phone number of the customer currently being billed.
export async function resolveCouponDiscount(
  code: string | undefined | null,
  amount: number,
  customerPhone?: string | null,
): Promise<{ code: string | null; discountAmount: number; error?: string }> {
  if (!code) return { code: null, discountAmount: 0 };

  const normalized = code.trim().toUpperCase();
  const coupon = await Coupon.findOne({ code: normalized });

  if (!coupon)         return { code: normalized, discountAmount: 0, error: 'Coupon code not found.' };
  if (coupon.usedAt)   return { code: normalized, discountAmount: 0, error: 'This coupon has already been used.' };
  if (!coupon.active)  return { code: normalized, discountAmount: 0, error: 'This coupon is no longer active.' };
  if (coupon.expiryDate && coupon.expiryDate < todayStr())
    return { code: normalized, discountAmount: 0, error: `This coupon expired on ${coupon.expiryDate}.` };

  // ── Per-customer lock ────────────────────────────────────────────────────
  // If this coupon was created for one specific customer, only that phone
  // number can redeem it — everyone else gets a clean rejection, even if
  // they somehow learn the code.
  if (coupon.customerPhone) {
    const requestPhone = (customerPhone ?? '').trim();
    if (!requestPhone) {
      return { code: normalized, discountAmount: 0, error: 'This coupon is reserved for a specific customer. Look up the customer first.' };
    }
    if (requestPhone !== coupon.customerPhone) {
      return { code: normalized, discountAmount: 0, error: 'This coupon is not valid for this customer.' };
    }
  }

  const discountAmount = coupon.discountType === 'percent'
    ? Math.round(amount * coupon.discountValue / 100)
    : Math.min(coupon.discountValue, amount);

  return { code: coupon.code, discountAmount };
}
// ─── Auto-generated "thank you" coupons ───────────────────────────────────────
//
// Called by bill.controller.ts right after a bill is saved. Rewards big
// spenders with a personal coupon for their NEXT visit — locked to their
// phone number (reuses the same customerPhone lock as manually-created
// per-customer coupons), so nobody else can redeem it.
//
export const AUTO_COUPON_THRESHOLD    = 2000;  // ← bill total must be >= this
export const AUTO_COUPON_PERCENT      = 10;    // ← % off the reward coupon gives
export const AUTO_COUPON_VALID_DAYS   = 30;    // ← days from today until it expires

function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)] ?? '';
  return `THANKS-${suffix}`;
}

export async function maybeCreateAutoCoupon(
  customerPhone: string,
  billTotal: number,
): Promise<{ code: string; discountValue: number; expiryDate: string } | null> {
  if (billTotal < AUTO_COUPON_THRESHOLD) return null;

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + AUTO_COUPON_VALID_DAYS);
  const expiryDate = expiry.toISOString().slice(0, 10);

  // Retry a few times in the unlikely event of a code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCouponCode();
    try {
      await Coupon.create({
        code,
        discountType:  'percent',
        discountValue: AUTO_COUPON_PERCENT,
        description:   `Thank-you reward for a ₹${billTotal.toLocaleString('en-IN')} visit`,
        expiryDate,
        active:        true,
        customerPhone,
      });
      console.log(`[coupon] auto-generated ${code} for ${customerPhone}, expires ${expiryDate}`);
      return { code, discountValue: AUTO_COUPON_PERCENT, expiryDate };
    } catch (err) {
      // Duplicate code (unique index) — try again with a fresh random code
      if ((err as { code?: number }).code === 11000) continue;
      console.error('[coupon] auto-generate failed:', err);
      return null;
    }
  }
  console.error('[coupon] auto-generate: exhausted retries on code collisions');
  return null;
}
// ─── GET /api/portal/coupons ───────────────────────────────────────────────────
// Returns this logged-in customer's own active, unexpired coupons (both
// manually-assigned and auto-generated "thank you" coupons). Locked strictly
// to their phone — customerPhone must match, so nobody can see coupons
// belonging to someone else.
export const getMyCoupons = async (req: Request, res: Response): Promise<void> => {
  try {
    // authenticateCustomer middleware attaches this directly from the JWT
    // payload — no DB lookup needed.
    const customerPhone = req.customerPhone;
    if (!customerPhone) { res.status(401).json({ message: 'Unauthorized' }); return; }

    const today = todayStr();
    const coupons = await Coupon.find({
      customerPhone,
      active: true,
      $or: [{ expiryDate: null }, { expiryDate: { $gte: today } }],
    }).sort({ createdAt: -1 }).lean();

    res.json(coupons);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch coupons', error: (err as Error).message });
  }
};