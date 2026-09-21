import { Router } from "express";
import {
  getBanners,
  getBannerById,
  createBanner,
  updateBanner,
  toggleBannerStatus,
  deleteBanner,
} from "../controllers/banner.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — active banners readable by the salon website
// GET /api/banners?status=active&type=hero
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", getBanners);

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED — CRM admin actions
// ─────────────────────────────────────────────────────────────────────────────
router.get   ("/:id",               authenticate, getBannerById);
router.post  ("/",                  authenticate, authorize("admin"), createBanner);
router.patch ("/:id/toggle-status", authenticate, authorize("admin"), toggleBannerStatus);
router.patch ("/:id",               authenticate, authorize("admin"), updateBanner);
router.delete("/:id",               authenticate, authorize("admin"), deleteBanner);

export default router;