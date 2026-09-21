import { Request, Response } from "express";
import { Banner } from "../models/banner.model.js";
import {
  validateCreateBanner,
  validateUpdateBanner,
  CreateBannerDto,
  UpdateBannerDto,
} from "../dtos/banner.dto.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL  /api/banners
//   ?type=hero|offer|combo
//   ?status=active|inactive|scheduled
//   ?page=1&limit=20
// ─────────────────────────────────────────────────────────────────────────────

// Same auto-downgrade pattern used for expired memberships in
// membership.controller.ts — a banner's `status` is set once by the admin
// and never flips on its own when `endDate` passes, so before every read we
// bulk-flip any `active` banner whose endDate is in the past to `inactive`.
// This keeps the DB (and therefore every consumer — admin page, public
// site, future screens) honest without needing date checks scattered
// across the frontend.
async function downgradeExpiredBanners(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  await Banner.bulkWrite([
    {
      updateMany: {
        filter: { status: "active", endDate: { $lt: todayStr } },
        update: { $set: { status: "inactive" } },
      },
    },
  ]);
}

export async function getBanners(req: Request, res: Response): Promise<void> {
  try {
    await downgradeExpiredBanners();

    const { type, status, page = "1", limit = "50" } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (type)   filter.type   = type;
    if (status) filter.status = status;

    const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Banner.countDocuments(filter);

    const banners = await Banner.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    res.json({
      success: true,
      data:    banners,
      meta:    { total, page: parseInt(page, 10), limit: parseInt(limit, 10) },
    });
  } catch (err) {
    console.error("[Banner] getBanners:", err);
    res.status(500).json({ success: false, message: "Failed to fetch banners" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ONE  /api/banners/:id
// ─────────────────────────────────────────────────────────────────────────────

export async function getBannerById(req: Request, res: Response): Promise<void> {
  try {
    await downgradeExpiredBanners();

    const banner = await Banner.findById(req.params.id).lean();
    if (!banner) {
      res.status(404).json({ success: false, message: "Banner not found" });
      return;
    }
    res.json({ success: true, data: banner });
  } catch (err) {
    console.error("[Banner] getBannerById:", err);
    res.status(500).json({ success: false, message: "Failed to fetch banner" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE  POST /api/banners
// ─────────────────────────────────────────────────────────────────────────────

export async function createBanner(req: Request, res: Response): Promise<void> {
  try {
    const rawBody = req.body as Partial<CreateBannerDto>;
    const errors = validateCreateBanner(rawBody);

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Validation failed", errors });
      return;
    }

    // Validation above guarantees the required fields are present.
    const body = rawBody as CreateBannerDto;

    const banner = await Banner.create({
      type:       body.type,
      title:      body.title.trim(),
      subtitle:   body.subtitle.trim(),
      badge:      body.badge.trim(),
      cta:        body.cta?.trim()        || "Book Now",
      discount:   body.discount?.trim()   || "",
      targetPage: body.targetPage.trim(),
      imageUrl:   body.imageUrl?.trim()   || "",
      status:     body.status             || "active",
      startDate:  body.startDate,
      endDate:    body.endDate,
      order:      body.order              ?? 1,
    });

    res.status(201).json({ success: true, data: banner });
  } catch (err) {
    console.error("[Banner] createBanner:", err);
    res.status(500).json({ success: false, message: "Failed to create banner" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE  PATCH /api/banners/:id
// ─────────────────────────────────────────────────────────────────────────────

export async function updateBanner(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Partial<UpdateBannerDto>;
    const errors = validateUpdateBanner(body);

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Validation failed", errors });
      return;
    }

    // Build update payload — only include fields actually sent
    const update: Partial<UpdateBannerDto> = {};
    if (body.type       !== undefined) update.type       = body.type;
    if (body.title      !== undefined) update.title      = body.title.trim();
    if (body.subtitle   !== undefined) update.subtitle   = body.subtitle.trim();
    if (body.badge      !== undefined) update.badge      = body.badge.trim();
    if (body.cta        !== undefined) update.cta        = body.cta.trim();
    if (body.discount   !== undefined) update.discount   = body.discount.trim();
    if (body.targetPage !== undefined) update.targetPage = body.targetPage.trim();
    if (body.imageUrl   !== undefined) update.imageUrl   = body.imageUrl.trim();
    if (body.status     !== undefined) update.status     = body.status;
    if (body.startDate  !== undefined) update.startDate  = body.startDate;
    if (body.endDate    !== undefined) update.endDate    = body.endDate;
    if (body.order      !== undefined) update.order      = body.order;

    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!banner) {
      res.status(404).json({ success: false, message: "Banner not found" });
      return;
    }

    res.json({ success: true, data: banner });
  } catch (err) {
    console.error("[Banner] updateBanner:", err);
    res.status(500).json({ success: false, message: "Failed to update banner" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE STATUS  PATCH /api/banners/:id/toggle-status
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleBannerStatus(req: Request, res: Response): Promise<void> {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      res.status(404).json({ success: false, message: "Banner not found" });
      return;
    }

    banner.status = banner.status === "active" ? "inactive" : "active";
    await banner.save();

    res.json({ success: true, data: banner.toObject() });
  } catch (err) {
    console.error("[Banner] toggleBannerStatus:", err);
    res.status(500).json({ success: false, message: "Failed to toggle banner status" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE  DELETE /api/banners/:id
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteBanner(req: Request, res: Response): Promise<void> {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id).lean();
    if (!banner) {
      res.status(404).json({ success: false, message: "Banner not found" });
      return;
    }
    res.json({ success: true, message: "Banner deleted successfully" });
  } catch (err) {
    console.error("[Banner] deleteBanner:", err);
    res.status(500).json({ success: false, message: "Failed to delete banner" });
  }
}