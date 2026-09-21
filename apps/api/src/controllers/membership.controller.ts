// ── membership.controller.ts ─────────────────────────────────────────────────
import { Request, Response } from "express";
// Fixed: was importing from "../db/Customer.model.js" — a separate, slim
// Mongoose model pointed at the same "customers" collection but missing
// fields like services[]/visits[]/dob/tags/gender/notes. Any save() through
// that model could silently fail to persist changes to those fields, or
// (worse, depending on the write path) drop them. Now imports the one real
// Customer schema used by every other controller (portal, bill, appointment,
// admin customer CRUD), which has been extended with hasAnnualPass /
// annualPassExpiry so it covers everything this file needs.
import { Customer, ICustomer, IReferral } from "../models/customer.model.js";
import {
  validateAddMember,
  validateUpgradeMembership,
  validateWalletAction,
  validateAnnualPass,
} from "../dtos/membership.dto.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function genReferralCode(name: string): string {
  const base =
    name
      .replace(/[^a-zA-Z]/g, "")
      .toUpperCase()
      .slice(0, 6) || "MEMBER";
  return `${base}${String(Math.floor(100 + Math.random() * 900))}`;
}

async function uniqueReferralCode(name: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = genReferralCode(name);
    const exists = await Customer.findOne({ referralCode: code }).lean();
    if (!exists) return code;
  }
  return "VLT" + Date.now().toString(36).toUpperCase();
}

/** Shape returned to the frontend — matches the Customer TS interface exactly */
function toDTO(doc: ICustomer) {
  return {
    _id:              String(doc._id),
    name:             doc.name,
    phone:            doc.phone,
    email:            doc.email ?? "",
    loyaltyPoints:    doc.loyaltyPoints,
    membershipTier:   doc.membershipTier,
    membershipExpiry: doc.membershipExpiry,
    totalSpent:       doc.totalSpent,
    visitCount:       doc.visitCount,
    lastVisit:        doc.lastVisit,
    referralCode:     doc.referralCode,
    referredByCode:   doc.referredByCode,
    referrals:        doc.referrals.map((r: IReferral) => ({
      _id:           String(r._id),
      referredName:  r.referredName,
      referredPhone: r.referredPhone,
      date:          r.date,
      status:        r.status,
      reward:        r.reward,
    })),
    hasAnnualPass:    doc.hasAnnualPass,
    annualPassExpiry: doc.annualPassExpiry,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/membership/customers
// ─────────────────────────────────────────────────────────────────────────────
// Compares a "YYYY-MM-DD" expiry against today's date (also YYYY-MM-DD) — plain
// string comparison works because ISO date strings sort lexicographically the
// same as chronologically, so no Date parsing/timezone issues.
function isPastExpiry(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

// Any paid tier (silver/gold/platinum) whose membershipExpiry has passed gets
// silently reverted to "none" here, before the list is ever sent to the
// frontend — otherwise an expired customer keeps showing a live Gold/Platinum
// badge (and keeps getting the billing discount) forever, since nothing else
// in the app currently checks the expiry date.
async function downgradeExpiredMemberships(customers: ICustomer[]): Promise<void> {
  const expired = customers.filter(
    (c) => c.membershipTier !== "none" && isPastExpiry(c.membershipExpiry)
  );
  if (expired.length === 0) return;

  await Customer.bulkWrite(
    expired.map((c) => ({
      updateOne: {
        filter: { _id: c._id },
        update: { $set: { membershipTier: "none", membershipExpiry: "" } },
      },
    }))
  );

  // Reflect the downgrade in the in-memory docs we're about to serialize,
  // so the response matches what's now actually in the DB.
  for (const c of expired) {
    c.membershipTier = "none";
    c.membershipExpiry = "";
  }
}

export const getAllCustomers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    await downgradeExpiredMemberships(customers);
    res.json(customers.map(toDTO));
  } catch (err) {
    console.error("[membership] getAllCustomers:", err);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/membership/customers
// Body: { name, phone, email? }
// ─────────────────────────────────────────────────────────────────────────────
export const addCustomer = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as { name: string; phone: string; email?: string };
  const error = validateAddMember(body);
  if (error) { res.status(400).json({ error }); return; }

  const { name, phone, email = "" } = body;

  try {
    const duplicate = await Customer.findOne({ phone: phone.trim() }).lean();
    if (duplicate) {
      res.status(409).json({ error: "A customer with this phone number already exists" });
      return;
    }

    const referralCode = await uniqueReferralCode(name);
    const customer = await Customer.create({
      name:  name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      referralCode,
    });

    res.status(201).json(toDTO(customer));
  } catch (err: unknown) {
    console.error("[membership] addCustomer:", err);
    if (typeof err === "object" && err !== null && "code" in err && err.code === 11000) {
      res.status(409).json({ error: "Duplicate phone or referral code" });
      return;
    }
    res.status(500).json({ error: "Failed to create customer" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/membership/customers/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await Customer.findByIdAndDelete(req.params.id);
    if (!doc) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json({ message: "Customer removed", _id: req.params.id });
  } catch (err) {
    console.error("[membership] deleteCustomer:", err);
    res.status(500).json({ error: "Failed to delete customer" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/membership/customers/:id/upgrade
// Body: { membershipTier, membershipExpiry?, hasAnnualPass, annualPassExpiry? }
// ─────────────────────────────────────────────────────────────────────────────
export const upgradeMembership = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as {
    membershipTier: "none" | "silver" | "gold" | "platinum";
    membershipExpiry?: string;
    hasAnnualPass?: boolean;
    annualPassExpiry?: string;
  };
  const error = validateUpgradeMembership(body);
  if (error) { res.status(400).json({ error }); return; }

  const {
    membershipTier,
    membershipExpiry    = "",
    hasAnnualPass       = false,
    annualPassExpiry    = "",
  } = body;

  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          membershipTier,
          membershipExpiry,
          hasAnnualPass,
          annualPassExpiry: hasAnnualPass ? annualPassExpiry : "",
        },
      },
      { new: true, runValidators: true }
    );
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json(toDTO(customer));
  } catch (err) {
    console.error("[membership] upgradeMembership:", err);
    res.status(500).json({ error: "Failed to upgrade membership" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/membership/customers/:id/wallet
// Body: { type: "add" | "deduct", points: number, reason?: string }
// ─────────────────────────────────────────────────────────────────────────────
export const walletAction = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as { type: "add" | "deduct"; points: number };
  const error = validateWalletAction(body);
  if (error) { res.status(400).json({ error }); return; }

  const { type, points } = body;
  const delta = type === "add" ? points : -points;

  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

        customer.loyaltyPoints = Math.max(0, customer.loyaltyPoints + delta);
    await customer.save();

    res.json(toDTO(customer));
  } catch (err) {
    console.error("[membership] walletAction:", err);
    res.status(500).json({ error: "Failed to update points" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/membership/customers/:id/annual-pass
// Body: { annualPassExpiry: "YYYY-MM-DD" }
// ─────────────────────────────────────────────────────────────────────────────
export const assignAnnualPass = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as { annualPassExpiry: string };
  const error = validateAnnualPass(body);
  if (error) { res.status(400).json({ error }); return; }

  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: { hasAnnualPass: true, annualPassExpiry: body.annualPassExpiry } },
      { new: true, runValidators: true }
    );
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json(toDTO(customer));
  } catch (err) {
    console.error("[membership] assignAnnualPass:", err);
    res.status(500).json({ error: "Failed to assign annual pass" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/membership/customers/:id/annual-pass
// ─────────────────────────────────────────────────────────────────────────────
export const removeAnnualPass = async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: { hasAnnualPass: false, annualPassExpiry: "" } },
      { new: true }
    );
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json(toDTO(customer));
  } catch (err) {
    console.error("[membership] removeAnnualPass:", err);
    res.status(500).json({ error: "Failed to remove annual pass" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/membership/customers/:id/referrals/:referralId/credit
// ─────────────────────────────────────────────────────────────────────────────
export const creditReferral = async (req: Request, res: Response): Promise<void> => {
  const { referralId } = req.params;
  if (!referralId) { res.status(400).json({ error: "referralId is required" }); return; }

  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

   const referral = customer.referrals.find((r) => r._id.toString() === referralId);
    if (!referral) { res.status(404).json({ error: "Referral not found" }); return; }
    if (referral.status === "credited") {
      res.status(409).json({ error: "Referral already credited" }); return;
    }
    if (referral.status !== "converted") {
      res.status(400).json({ error: "Referral must be 'converted' before crediting" }); return;
    }

    referral.status = "credited";
        customer.loyaltyPoints = customer.loyaltyPoints + referral.reward * 10;
    await customer.save();

    res.json(toDTO(customer));
  } catch (err) {
    console.error("[membership] creditReferral:", err);
    res.status(500).json({ error: "Failed to credit referral" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/membership/stats
// ─────────────────────────────────────────────────────────────────────────────
export const getStats = async (_req: Request, res: Response): Promise<void> => {
  try {
   interface TotalsAgg {
      total: number;
      silver: number;
      gold: number;
      platinum: number;
      totalPts: number;
      annualPass: number;
    }
    interface ReferralAgg {
      totalReferrals: number;
      convertedReferrals: number;
      rewardsGiven: number;
    }

    const [totals] = await Customer.aggregate<TotalsAgg>([
      {
        $group: {
          _id:        null,
          total:      { $sum: 1 },
          silver:     { $sum: { $cond: [{ $eq: ["$membershipTier", "silver"]   }, 1, 0] } },
          gold:       { $sum: { $cond: [{ $eq: ["$membershipTier", "gold"]     }, 1, 0] } },
          platinum:   { $sum: { $cond: [{ $eq: ["$membershipTier", "platinum"] }, 1, 0] } },
          totalPts:   { $sum: "$loyaltyPoints" },
          annualPass: { $sum: { $cond: ["$hasAnnualPass", 1, 0] } },
        },
      },
    ]);

    const [refTotals] = await Customer.aggregate<ReferralAgg>([
      { $unwind: { path: "$referrals", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id:                null,
          totalReferrals:     { $sum: 1 },
          convertedReferrals: { $sum: { $cond: [{ $in: ["$referrals.status", ["converted", "credited"]] }, 1, 0] } },
          rewardsGiven:       { $sum: { $cond: [{ $eq: ["$referrals.status", "credited"] }, "$referrals.reward", 0] } },
        },
      },
    ]);

    res.json({
      total:              totals?.total              ?? 0,
      silver:             totals?.silver             ?? 0,
      gold:               totals?.gold               ?? 0,
      platinum:           totals?.platinum           ?? 0,
      totalPts:           totals?.totalPts           ?? 0,
      annualPassCount:    totals?.annualPass          ?? 0,
      totalReferrals:     refTotals?.totalReferrals   ?? 0,
      convertedReferrals: refTotals?.convertedReferrals ?? 0,
      rewardsGiven:       refTotals?.rewardsGiven     ?? 0,
    });
  } catch (err) {
    console.error("[membership] getStats:", err);
    res.status(500).json({ error: "Failed to compute stats" });
  }
};