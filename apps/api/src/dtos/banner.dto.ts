// ─────────────────────────────────────────────────────────────────────────────
// CREATE DTO
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateBannerDto {
  type:        "hero" | "offer" | "combo";
  title:       string;
  subtitle:    string;
  badge:       string;
  cta?:        string;
  discount?:   string;
  targetPage:  string;
  imageUrl?:   string;
  status?:     "active" | "inactive" | "scheduled";
  startDate:   string;
  endDate:     string;
  order?:      number;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE DTO  (all fields optional — PATCH semantics)
// ─────────────────────────────────────────────────────────────────────────────

export interface UpdateBannerDto {
  type?:       "hero" | "offer" | "combo";
  title?:      string;
  subtitle?:   string;
  badge?:      string;
  cta?:        string;
  discount?:   string;
  targetPage?: string;
  imageUrl?:   string;
  status?:     "active" | "inactive" | "scheduled";
  startDate?:  string;
  endDate?:    string;
  order?:      number;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TYPES   = ["hero", "offer", "combo"] as const;
const VALID_STATUSES = ["active", "inactive", "scheduled"] as const;

export function validateCreateBanner(body: Partial<CreateBannerDto>): string[] {
  const errors: string[] = [];

  if (!body.type || !VALID_TYPES.includes(body.type as never))
    errors.push("type must be one of: hero, offer, combo");

  if (!body.title?.trim())      errors.push("title is required");
  if (!body.subtitle?.trim())   errors.push("subtitle is required");
  if (!body.badge?.trim())      errors.push("badge is required");
  if (!body.targetPage?.trim()) errors.push("targetPage is required");
  if (!body.startDate)          errors.push("startDate is required");
  if (!body.endDate)            errors.push("endDate is required");

  if (
    body.status &&
    !VALID_STATUSES.includes(body.status as never)
  )
    errors.push("status must be one of: active, inactive, scheduled");

  if (body.order !== undefined && (typeof body.order !== "number" || body.order < 1))
    errors.push("order must be a positive number");

  return errors;
}

export function validateUpdateBanner(body: Partial<UpdateBannerDto>): string[] {
  const errors: string[] = [];

  if (body.type && !VALID_TYPES.includes(body.type as never))
    errors.push("type must be one of: hero, offer, combo");

  if (body.status && !VALID_STATUSES.includes(body.status as never))
    errors.push("status must be one of: active, inactive, scheduled");

  if (body.order !== undefined && (typeof body.order !== "number" || body.order < 1))
    errors.push("order must be a positive number");

  return errors;
}