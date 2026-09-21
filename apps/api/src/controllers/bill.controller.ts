import { Request, Response } from 'express';
import mongoose              from 'mongoose';
import { Bill }              from '../models/bill.model.js';
import { Customer, ICustomer } from '../models/customer.model.js';
import { Appointment }       from '../models/appointment.model.js';   // ← added
import { StaffRoleMember }   from '../models/staffRole.model.js';     // ← added
import { CreateBillDto, BillQueryDto, validateCreateBillDto } from '../dtos/bill.dto.js';
import { deductInventoryForBill } from '../services/inventoryDeduction.service.js';
import { resolveCouponDiscount, maybeCreateAutoCoupon, markCouponUsed } from './coupon.controller.js';
import { generateInvoicePdf } from '../services/invoicePdf.service.js';   // ← added
const LOYALTY_PER_RUPEE = 1 / 100; // 1 pt per ₹100

// ── Staff ID → Name resolution ──────────────────────────────────────────────
// REPLACED the old hardcoded STAFF_MAP ('1'..'4' → static names), which
// predates StaffRoleMember and stopped matching real staff ObjectIds — it was
// silently falling back to returning the raw id unchanged, which is why
// staff names showed up as ObjectIds on the ContactPage invoice and the
// Customers → Visits tab. Now does a real batched DB lookup instead.
//
// Batch-resolves every unique staffId in a bill's items in ONE query
// (avoids N lookups) and returns a Map for cheap repeated access.
async function buildStaffNameMap(items: { staffId: string }[]): Promise<Map<string, string>> {
  const ids = [...new Set(items.map(i => i.staffId).filter(Boolean))];
  const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));

  const staff = validIds.length
    ? await StaffRoleMember.find({ _id: { $in: validIds } }).select('_id name').lean()
    : [];

  const map = new Map<string, string>();
  for (const s of staff) map.set(String(s._id), s.name);
  return map;
}

// ─── GET /api/bills/:id/invoice ────────────────────────────────────────────
//
// Streams a PDF invoice for a bill, looked up by either its Mongo _id or
// its human-facing Order ID (billNumber, e.g. "VLT-00042"). Lets admins
// pull up and (re)download any past invoice on demand — not just right
// after it was created.
//
// ?view=true → Content-Disposition: inline (opens in-browser instead of
// forcing a download), useful for a quick look before printing/sharing.
//
export const getBillInvoicePdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string' || !id) {
      res.status(400).json({ message: 'Invalid id parameter' });
      return;
    }

    const bill = mongoose.Types.ObjectId.isValid(id)
      ? await Bill.findById(id).populate('customer', 'name phone')
      : await Bill.findOne({ billNumber: id.toUpperCase() }).populate('customer', 'name phone');

    if (!bill) {
      res.status(404).json({ message: 'Bill not found.' });
      return;
    }

    const staffNameMap = await buildStaffNameMap(bill.items);
    const resolveStaffName = (staffId: string): string =>
      bill.items.find(i => i.staffId === staffId)?.staffName
      || staffNameMap.get(staffId)
      || staffId;

    const pdfBuffer = await generateInvoicePdf(bill, resolveStaffName);

    const disposition = req.query.view === 'true' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="Invoice-${bill.billNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[getBillInvoicePdf] error:', err);
    res.status(500).json({ message: 'Failed to generate invoice PDF', error: (err as Error).message });
  }
};
// ─── Referral Reward ──────────────────────────────────────────────────────────
//
// Called after a bill is saved with status === 'paid'.
//
// Flow:
//   1. Customer must have referredByCode set.
//   2. This must be their FIRST ever paid bill (countDocuments === 1).
//   3. Find the referrer whose referralCode === customer.referredByCode.
//   4. Find OR CREATE the pending referral entry in referrer.referrals
//      that matches the new customer's phone.
//   5. Credit +100 loyalty pts to the referrer, mark referral 'credited'.
//
// Non-critical — any error is caught and logged; never blocks the bill response.
//
async function processReferralReward(
  customerId: mongoose.Types.ObjectId,
  customerPhone: string,
): Promise<{ rewarded: boolean; referrerName?: string }> {
  try {
    // 1. Load customer — need referredByCode and name
    const customer = await Customer.findById(customerId).select('referredByCode name');
    if (!customer?.referredByCode) return { rewarded: false };

    // 2. Guard: only reward on the very first paid bill
    const paidCount = await Bill.countDocuments({
      customer: customerId,
      status:   'paid',
    });
    if (paidCount !== 1) return { rewarded: false };

    // 3. Find the referrer by their referralCode
    const referrer = await Customer.findOne({
      referralCode: customer.referredByCode,
    });
    if (!referrer) return { rewarded: false };

    // 4. Find OR CREATE the matching pending referral entry
    //    - If customer signed up via portal, the entry already exists (pending)
    //    - If customer was created via billing (walk-in with referredByCode),
    //      no entry exists yet — create it now before crediting
    let referral = referrer.referrals.find(
      r => r.referredPhone === customerPhone && r.status === 'pending',
    );

    if (!referral) {
      // Check it wasn't already credited (avoid double-rewarding)
      const alreadyCredited = referrer.referrals.find(
        r => r.referredPhone === customerPhone && r.status === 'credited',
      );
      if (alreadyCredited) return { rewarded: false };

      // Create the entry now
      referrer.referrals.push({
        referredName:  customer.name,
        referredPhone: customerPhone,
        date:          new Date().toISOString().slice(0, 10),
        status:        'pending',
        reward:        100,
      } as never);

      await referrer.save();

      // Re-fetch the entry we just pushed
      referral = referrer.referrals.find(
        r => r.referredPhone === customerPhone && r.status === 'pending',
      );

      if (!referral) return { rewarded: false };
    }

    // 5. Credit the referrer
    referral.status        = 'credited';
    referral.reward        = 100;
    referrer.loyaltyPoints = (referrer.loyaltyPoints || 0) + 100;

    await referrer.save();

    console.log(
      `[referral] Credited ${referrer.name} +100 pts for referring ${customerPhone}`,
    );

    return { rewarded: true, referrerName: referrer.name };
  } catch (err) {
    console.error('[referral] processReferralReward error:', err);
    return { rewarded: false };
  }
}

// ─── GET /api/bills ───────────────────────────────────────────────────────────

export const getBills = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit } = req.query as BillQueryDto;

    const bills = await Bill.find()
      .sort({ createdAt: -1 })
      .limit(Number(limit) || 15)
      .populate('customer', 'name phone')
      .lean();

    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bills', error: (err as Error).message });
  }
};

// ─── POST /api/bills ──────────────────────────────────────────────────────────

export const createBill = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CreateBillDto;

    // ── Validate ─────────────────────────────────────────────────────────────
    const errors = validateCreateBillDto(body);
    if (errors.length) {
      res.status(400).json({ message: errors.join(', ') });
      return;
    }

        const {
      phone, customerName, customerId,
      items, subtotal, membershipDiscount,
      discountType, discountValue, discountAmount,
      loyaltyRedeemed, total, paymentMethod,
      status, notes, date,
      appointmentId,   // ← added
    } = body;

    // ← ADD THIS BLOCK: pulled separately since CreateBillDto may not yet
    // declare these fields — cast avoids touching the DTO file.
    const { redeemedReferralIds, referralDiscount } = req.body as {
      redeemedReferralIds?: string[];
      referralDiscount?: number;
    };

    // ── Recompute coupon discount server-side ─────────────────────────────
    // The base is subtotal after membership + manual discount — same order
    // the Billing page uses, so the preview shown to staff matches what's
    // actually charged. Never trust a client-supplied discount amount here.
    const couponBase = subtotal - membershipDiscount - discountAmount;
    let couponDiscountFinal = 0;
    let couponCodeFinal: string | null = null;

    if (body.couponCode) {
      const result = await resolveCouponDiscount(body.couponCode, Math.max(0, couponBase), phone.trim());
      if (result.error) {
        res.status(400).json({ message: `Coupon problem: ${result.error}` });
        return;
      }
      couponCodeFinal     = result.code;
      couponDiscountFinal = result.discountAmount;
    }

    // ── Resolve staff names once for this bill ───────────────────────────────
    const staffNameMap = await buildStaffNameMap(items);
    const resolveStaffName = (staffId: string): string =>
      staffNameMap.get(staffId) ?? staffId;

   // ── Atomically claim the appointment so it can't be billed twice ─────────
    // This MUST happen before Bill.create — otherwise two near-simultaneous
    // requests (double-click, retry, etc.) can both pass validation and each
    // create their own Bill document for the same appointment, double-counting
    // customer.visitCount / totalSpent / services.
    let sourceAppointment = null;
    if (appointmentId && mongoose.Types.ObjectId.isValid(appointmentId)) {
      sourceAppointment = await Appointment.findOneAndUpdate(
        { _id: appointmentId, status: { $ne: 'billed' } },
        { status: 'billed' },
        { new: false } // returns null if it didn't match (already billed)
      );

      const apptExists = await Appointment.exists({ _id: appointmentId });
      if (apptExists && !sourceAppointment) {
        res.status(409).json({ message: 'This appointment has already been billed.' });
        return;
      }
    }

    // ── Resolve bill date ──────────────────────────────────────────────────
    // Priority: explicit `date` from request → linked appointment's own date
    // (so billing a 1 Jul appointment a few days later doesn't silently
    // relabel the visit as "today") → today as last resort for walk-ins.
    const billDate = date ?? sourceAppointment?.date ?? new Date().toISOString().slice(0, 10);

    // ── Resolve customer ─────────────────────────────────────────────────────
    // Priority: customerId → exact phone match → upsert new walk-in
    let customer: mongoose.HydratedDocument<ICustomer> | null = null;

    // 1. By ID — most reliable when frontend sends _id from lookup
    if (customerId) {
      try {
        customer = await Customer.findById(customerId);
      } catch {
        // Bad ObjectId — fall through to phone lookup
      }
    }

    // 2. By exact phone — catches cases where customerId not sent / stale
    if (!customer) {
      customer = await Customer.findOne({ phone: phone.trim() });
    }

    // 3. Genuinely new number — upsert minimal walk-in profile
    //    findOneAndUpdate avoids required-field errors (email, gender, dob)
    if (!customer) {
      customer = await Customer.findOneAndUpdate(
        { phone: phone.trim() },
        {
          $setOnInsert: {
            name:           customerName && customerName !== 'Walk-in'
                              ? customerName
                              : 'Walk-in',
            phone:          phone.trim(),
            loyaltyPoints:  0,
            membershipTier: 'none',
            visitCount:     0,
            totalSpent:     0,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    }

    if (!customer) {
      res.status(500).json({ message: 'Failed to resolve customer.' });
      return;
    }

   // ── Create bill ──────────────────────────────────────────────────────────
    // Attach resolved staffName to every item so downstream readers (customer
    // portal invoice, admin Visits tab, etc.) never need their own lookup.
    const itemsWithStaffNames = items.map(i => ({
      ...i,
      staffName: staffNameMap.get(i.staffId) ?? i.staffId,
    }));

        const bill = await Bill.create({
      phone:              phone.trim(),
      customerName:       customer.name,
      customer:           customer._id,
      items:              itemsWithStaffNames,
      subtotal,
      membershipDiscount,
      discountType,
      discountValue,
      discountAmount,
      couponCode:         couponCodeFinal,
      couponDiscount:     couponDiscountFinal,
      loyaltyRedeemed,
      referralDiscount:   referralDiscount || 0, // ← ADD THIS LINE (matches the field destructured earlier)
      total,
      paymentMethod,
      status,
      notes:       notes ?? '',
      date:        billDate,
      appointment: appointmentId ?? null,
    });

    // ── Burn the coupon so it can never be redeemed again ──────────────────
    // Runs regardless of paid/pending status — once a discount is granted on
    // a bill, the code is spent, same as a real-world one-time voucher.
    if (couponCodeFinal) {
      await markCouponUsed(couponCodeFinal);
    }

    // ── Link the new bill back to the appointment ────────────────────────────
    // Status was already flipped to 'billed' atomically above — just attach
    // the bill reference now that we have its _id.
    if (appointmentId && mongoose.Types.ObjectId.isValid(appointmentId) && sourceAppointment) {
      try {
        await Appointment.findByIdAndUpdate(appointmentId, { bill: bill._id });
      } catch (apptErr) {
        console.error('[bill] failed to link bill to appointment:', apptErr);
      }
    }

    // ── Update customer stats ────────────────────────────────────────────────
    const pointsEarned = Math.floor(total * LOYALTY_PER_RUPEE);
    const pointsUsed   = loyaltyRedeemed;

    // Deduplicated staff string for the visit record
    const staffNames = [
      ...new Set(items.map(i => resolveStaffName(i.staffId))),
    ].join(', ');

   // ── Reconcile with any completion-sync entries instead of duplicating ──
    // If this bill's source appointment was already marked "completed"
    // before being billed, appointmentService.syncCustomerVisitOnCompletion()
    // already pushed a services[]/visits[] entry for it (usually at price 0,
    // since the price wasn't resolved at completion time). Update those
    // existing entries in place rather than pushing new ones, so the
    // customer ends up with exactly one record per visit, not two.
    let reconciledPriorTotal = 0;

// Distribute the bill's actual (post-discount) total across items in
// proportion to their gross price, so customer.services[].price always
// matches what visits[].total shows for the same visit — item.price
// itself (used for the Bill document, invoice, subtotal, etc.) is left
// untouched.
const grossItemsSubtotal = items.reduce((sum, i) => sum + i.price, 0) || 1;
const netItemPrice = (itemPrice: number): number =>
  Math.round((itemPrice / grossItemsSubtotal) * total);

for (const item of items) {
  if (!item.serviceName) continue;

  const existingService = sourceAppointment
    ? customer.services.find(
        s => s.appointmentId?.toString() === sourceAppointment._id.toString() &&
             s.service === item.serviceName &&
             s.rating == null
      )
    : customer.services.find(
        s => s.date.slice(0, 10) === billDate &&
             s.service === item.serviceName &&
             s.rating == null &&
             s.price === 0
      );

 if (existingService) {
    reconciledPriorTotal += existingService.price;
    existingService.price    = netItemPrice(item.price);
    existingService.staff    = resolveStaffName(item.staffId);
    existingService.duration = item.duration;
    existingService.date     = billDate;
  } else {
    customer.services.push({
      date:     billDate,
      service:  item.serviceName,
      staff:    resolveStaffName(item.staffId),
      duration: item.duration,
      price:    netItemPrice(item.price),
      appointmentId: appointmentId ?? null,
    } as never);
  }
}

   const billServiceNames = new Set(items.map(i => i.serviceName).filter(Boolean));

const existingVisit = sourceAppointment
  ? customer.visits.find(
      v => v.appointmentId?.toString() === sourceAppointment._id.toString()
    )
  : customer.visits.find(
      v => v.date === billDate &&
           v.services.length === billServiceNames.size &&
           v.services.every(s => billServiceNames.has(s)) &&
           v.total === 0   // ← same fix: only merge into an unbilled placeholder, not a real prior visit
    );

if (existingVisit) {
  reconciledPriorTotal = Math.max(reconciledPriorTotal, existingVisit.total);
  existingVisit.date     = billDate;          // ← correct the date now that it's billed
  existingVisit.total    = total;
  existingVisit.staff    = staffNames;
  existingVisit.notes    = notes ?? '';
} else {
  customer.visits.push({
    date:     billDate,
    services: items.map(i => i.serviceName),
    staff:    staffNames,
    total,
    notes:    notes ?? '',
    appointmentId: appointmentId ?? null,     // ← added, mirrors services[] fix
  } as never);
}

    // Sync top-level counters — subtract whatever the completion-sync hook
    // already counted toward totalSpent for this visit, then add the real
    // billed total, so we don't double-count.
        customer.visitCount    = customer.visits.length;
    customer.totalSpent    = Math.max(0, (customer.totalSpent || 0) - reconciledPriorTotal) + total;
    customer.lastVisit     = billDate;

    // ← ADD THIS BLOCK: mark any pending referrals the staff toggled on in
    // Billing as converted, and credit their reward to this customer (the
    // referrer) — separate from the existing "first bill" auto-reward flow.
    let manualReferralReward = 0;
    if (Array.isArray(redeemedReferralIds) && redeemedReferralIds.length > 0) {
      customer.referrals.forEach((ref) => {
        if (
          redeemedReferralIds.includes(ref._id.toString()) &&
          ref.status === 'pending'
        ) {
          ref.status = 'converted';
          manualReferralReward += ref.reward || 0;
        }
      });
    }

    customer.loyaltyPoints =
      Math.max(0, (customer.loyaltyPoints || 0) - pointsUsed) + pointsEarned + manualReferralReward; // ← CHANGED: include manualReferralReward

    // Save customer — isolated try/catch so a stats failure never
    // blocks the bill response (bill is already committed to DB above)
    try {
      await customer.save();
    } catch (saveErr) {
      console.error('[bill] customer.save() failed:', saveErr);
    }

    // ── Deduct inventory for services rendered ───────────────────────────────
    // Fire-and-forget — bill is already saved, inventory failure never blocks response
        deductInventoryForBill(itemsWithStaffNames, bill.billNumber, billDate)
      .then(results => {
        const skipped = results.filter(r => r.skipped);
        if (skipped.length) {
          console.warn('[bill] inventory deduction skipped for:', skipped);
        } else {
          console.log(`[bill] inventory deducted for bill ${bill.billNumber} — ${String(results.length)} product(s)`);
        }
      })
      .catch((err: unknown) => { console.error('[bill] inventory deduction error:', err); });

       // ── Process referral reward (only on paid bills) ──────────────────────────
    let referralRewarded     = false;
    let referralReferrerName: string | null = null;

    if (status === 'paid') {
      const result = await processReferralReward(
        customer._id,
        phone.trim(),
      );
      referralRewarded     = result.rewarded;
      referralReferrerName = result.referrerName ?? null;
    }

    // ← ADD THIS BLOCK: surface the manual toggle-based conversion in the
    // same banner the frontend already reads (referral_rewarded / referral_referrer_name)
    if (manualReferralReward > 0) {
      referralRewarded     = true;
      referralReferrerName = customer.name;
    }

    // ── Auto-generate a thank-you coupon for big-ticket paid bills ────────────
    // Non-critical — failure here should never block the bill response, the
    // bill itself is already committed above.
    let autoCoupon: { code: string; discountValue: number; expiryDate: string } | null = null;
    if (status === 'paid') {
      try {
        autoCoupon = await maybeCreateAutoCoupon(phone.trim(), total);
      } catch (err) {
        console.error('[bill] auto-coupon generation failed:', err);
      }
    }

    // ── Return populated bill ────────────────────────────────────────────────
    const populated = await Bill.findById(bill._id)
      .populate('customer', 'name phone')
      .lean();

    res.status(201).json({
      ...populated,
      // Frontend reads these two fields to show a referral reward
      // toast/banner inside the invoice modal (BillingPage.tsx)
      referral_rewarded:      referralRewarded,
      referral_referrer_name: referralReferrerName,
      // Frontend reads this to show a "you earned a coupon" banner and
      // include it in the WhatsApp invoice message
      auto_coupon: autoCoupon,
    });
  } catch (err) {
    console.error('[createBill] error:', err);
    res.status(500).json({
      message: 'Failed to create bill',
      error:   (err as Error).message,
    });
  }
};

// ─── PATCH /api/bills/:id/status ─────────────────────────────────────────────
//
// Allows admin/receptionist to flip a bill between 'paid' and 'pending'.
// Also triggers referral reward processing when a bill is marked paid
// for the first time (in case it was originally saved as pending).
//
// ─── PATCH /api/bills/:id ─────────────────────────────────────────────────────
//
// Edits an EXISTING bill in place — used when staff need to correct a price,
// staff assignment, discount, or payment method on a bill that's already
// been generated, without creating a brand-new transaction record.
//
// Unlike createBill, this does NOT touch visitCount/totalSpent by adding a
// new visit — it adjusts the existing Bill, and reconciles the matching
// customer.services[]/visits[] entries in place (regardless of rating
// status, since this is an explicit "fix this exact bill" action, not the
// implicit completion-vs-billing reconciliation createBill does).
//
export const updateBill = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid bill ID.' });
      return;
    }

    const bill = await Bill.findById(id);
    if (!bill) {
      res.status(404).json({ message: 'Bill not found.' });
      return;
    }

    const body = req.body as Partial<CreateBillDto>;

       const {
      items, subtotal, membershipDiscount,
      discountType, discountValue, discountAmount,
      loyaltyRedeemed, total, paymentMethod,
      status, notes, date,
    } = body;

    // ← ADD THIS BLOCK
    const { redeemedReferralIds } = req.body as { redeemedReferralIds?: string[] };

     if (items !== undefined && (!Array.isArray(items) || items.length === 0)) {
      res.status(400).json({ message: 'items must be a non-empty array.' });
      return;
    }
    if (total !== undefined && (typeof total !== 'number' || total < 0)) {
      res.status(400).json({ message: 'total must be a non-negative number.' });
      return;
    }

    // ── Capture old totals BEFORE mutating, so we can reconcile customer stats ──
    const oldTotal = bill.total;
    const oldDate  = bill.date;

    // ── Resolve staff names for any updated items, same as createBill ────────
    let itemsWithStaffNames: (typeof items extends undefined ? never : NonNullable<typeof items>[number] & { staffName: string })[] | undefined;
    if (items !== undefined) {
      const staffNameMapForUpdate = await buildStaffNameMap(items);
      itemsWithStaffNames = items.map(i => ({
        ...i,
        staffName: staffNameMapForUpdate.get(i.staffId) ?? i.staffId,
      }));
    }

    // ── Apply edits to the bill itself ──────────────────────────────────────
    if (itemsWithStaffNames !== undefined) bill.items = itemsWithStaffNames;
    if (subtotal           !== undefined) bill.subtotal           = subtotal;
    if (membershipDiscount !== undefined) bill.membershipDiscount = membershipDiscount;
    if (discountType       !== undefined) bill.discountType       = discountType;
    if (discountValue      !== undefined) bill.discountValue      = discountValue;
    if (discountAmount     !== undefined) bill.discountAmount     = discountAmount;
    if (loyaltyRedeemed    !== undefined) bill.loyaltyRedeemed    = loyaltyRedeemed;
    if (total              !== undefined) bill.total              = total;
    if (paymentMethod      !== undefined) bill.paymentMethod      = paymentMethod;
    if (status             !== undefined) bill.status             = status;
    if (notes              !== undefined) bill.notes              = notes;
    if (date               !== undefined) bill.date               = date;

    // ── Recompute coupon discount server-side, if a coupon change was sent ──
    // Uses the bill's own (now-updated) subtotal/membershipDiscount/discountAmount
    // as the base, same order createBill uses. Passing couponCode: "" or null
    // clears the coupon from the bill.
   let couponJustAppliedInEdit: string | null = null;

    if (body.couponCode !== undefined) {
      const couponBase = bill.subtotal - bill.membershipDiscount - bill.discountAmount;

      if (!body.couponCode) {
        bill.couponCode     = null;
        bill.couponDiscount = 0;
      } else {
        // Skip re-validation if this bill already had this exact coupon applied —
        // otherwise re-saving an unrelated edit on the same bill would reject it
        // for being "already used" by itself.
        if (body.couponCode.trim().toUpperCase() !== bill.couponCode) {
          const result = await resolveCouponDiscount(body.couponCode, Math.max(0, couponBase), bill.phone);
          if (result.error) {
            res.status(400).json({ message: `Coupon problem: ${result.error}` });
            return;
          }
          bill.couponCode     = result.code;
          bill.couponDiscount = result.discountAmount;
          couponJustAppliedInEdit = result.code;
        }
      }
    }

    await bill.save();

    if (couponJustAppliedInEdit) {
      await markCouponUsed(couponJustAppliedInEdit);
    }

   // ── Reconcile customer.services[] / visits[] / top-level stats ─────────
    if (bill.customer) {
      const customer = await Customer.findById(bill.customer);
      if (customer) {
        // Resolve staff names for this update the same way createBill does
        const staffNameMap = await buildStaffNameMap(bill.items);
        const resolveStaffName = (staffId: string): string =>
          staffNameMap.get(staffId) ?? staffId;

        const staffNames = [
          ...new Set(bill.items.map(i => resolveStaffName(i.staffId))),
        ].join(', ');

        // Update every services[] entry tied to this bill's appointment
        // (or, if no appointment, fall back to matching by old date — same
        // heuristic createBill uses for walk-ins) — REGARDLESS of rating,
        // since this is an explicit edit to a known bill.
        const apptId = bill.appointment;

        for (const item of bill.items) {
          if (!item.serviceName) continue;

          const match = apptId
            ? customer.services.find(
                s => s.appointmentId?.toString() === apptId.toString() &&
                     s.service === item.serviceName
              )
            : customer.services.find(
                s => s.date.slice(0, 10) === oldDate &&
                     s.service === item.serviceName
              );

          if (match) {
            match.price    = item.price;
            match.staff    = resolveStaffName(item.staffId);
            match.duration = item.duration;
            match.date     = bill.date;
          }
        }

       const matchVisit = apptId
          ? customer.visits.find(
              v => v.appointmentId?.toString() === apptId.toString()
            )
          : customer.visits.find(v => v.date === oldDate);

        if (matchVisit) {
          matchVisit.date  = bill.date;
          matchVisit.total = bill.total;
          matchVisit.staff = staffNames;
          matchVisit.notes = bill.notes;
        }

               // Adjust totalSpent by the DELTA between old and new total —
        // not a full re-add, since this visit was already counted once.
        customer.totalSpent = Math.max(0, (customer.totalSpent || 0) - oldTotal) + bill.total;
        customer.lastVisit  = customer.visits.map(v => v.date).sort().at(-1) ?? customer.lastVisit;

        // ← ADD THIS BLOCK: same referral-conversion logic as createBill
        if (Array.isArray(redeemedReferralIds) && redeemedReferralIds.length > 0) {
          let manualReferralReward = 0;
          customer.referrals.forEach((ref) => {
            if (
              redeemedReferralIds.includes(ref._id.toString()) &&
              ref.status === 'pending'
            ) {
              ref.status = 'converted';
              manualReferralReward += ref.reward || 0;
            }
          });
          customer.loyaltyPoints = (customer.loyaltyPoints || 0) + manualReferralReward;
        }

        try {
          await customer.save();
        } catch (saveErr) {
          console.error('[updateBill] customer.save() failed:', saveErr);
        }
      }
    }

    const populated = await Bill.findById(bill._id)
      .populate('customer', 'name phone')
      .lean();

    res.json(populated);
  } catch (err) {
    console.error('[updateBill] error:', err);
    res.status(500).json({
      message: 'Failed to update bill.',
      error:   (err as Error).message,
    });
  }
};