// ── membership.routes.ts ─────────────────────────────────────────────────────
import { Router } from "express";
import {
  getAllCustomers,
  addCustomer,
  deleteCustomer,
  upgradeMembership,
  walletAction,
  assignAnnualPass,
  removeAnnualPass,
  creditReferral,
  getStats,
} from "../controllers/membership.controller.js";

const router = Router();

// Stats
router.get("/stats", getStats);

// Customers
router.get("/customers",        getAllCustomers);
router.post("/customers",       addCustomer);
router.delete("/customers/:id", deleteCustomer);

// Tier upgrade (also handles annual pass in one call)
router.patch("/customers/:id/upgrade", upgradeMembership);

// Loyalty wallet
router.patch("/customers/:id/wallet", walletAction);

// Annual pass
router.patch("/customers/:id/annual-pass",  assignAnnualPass);
router.delete("/customers/:id/annual-pass", removeAnnualPass);

// Referral credit
router.patch("/customers/:id/referrals/:referralId/credit", creditReferral);

export default router;