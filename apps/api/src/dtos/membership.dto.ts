// ── membership.dto.ts ────────────────────────────────────────────────────────

const TIERS       = ["none", "silver", "gold", "platinum"] as const;
const DATE_RE     = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_RE    = /^\d{7,15}$/;

export type MembershipTier = (typeof TIERS)[number];

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface AddMemberDto {
  name: string;
  phone: string;
  email?: string;
}

export interface UpgradeMembershipDto {
  membershipTier: MembershipTier;
  membershipExpiry?: string;
  hasAnnualPass: boolean;
  annualPassExpiry?: string;
}

export interface WalletActionDto {
  type: "add" | "deduct";
  points: number;
  reason?: string;
}

export interface AnnualPassDto {
  annualPassExpiry: string;
}

// ── Validators ────────────────────────────────────────────────────────────────

export function validateAddMember(body: Partial<AddMemberDto>): string | null {
  if (!body.name?.trim())                          return "name is required";
  if (!body.phone || !PHONE_RE.test(body.phone.trim()))
                                                   return "phone must be 7–15 digits";
  if (body.email && typeof body.email !== "string") return "email must be a string";
  return null;
}

export function validateUpgradeMembership(body: Partial<UpgradeMembershipDto>): string | null {
  if (!body.membershipTier || !TIERS.includes(body.membershipTier))
    return `membershipTier must be one of: ${TIERS.join(", ")}`;
  if (body.membershipExpiry && !DATE_RE.test(body.membershipExpiry))
    return "membershipExpiry must be YYYY-MM-DD or empty";
  if (body.hasAnnualPass) {
    if (!body.annualPassExpiry || !DATE_RE.test(body.annualPassExpiry))
      return "annualPassExpiry must be YYYY-MM-DD when hasAnnualPass is true";
  }
  return null;
}

export function validateWalletAction(body: Partial<WalletActionDto>): string | null {
  if (!body.type || !["add", "deduct"].includes(body.type))     return "type must be 'add' or 'deduct'";
  const p = Number(body.points);
  if (!Number.isInteger(p) || p <= 0)              return "points must be a positive integer";
  return null;
}

export function validateAnnualPass(body: Partial<AnnualPassDto>): string | null {
  if (!body.annualPassExpiry || !DATE_RE.test(body.annualPassExpiry))
    return "annualPassExpiry must be YYYY-MM-DD";
  return null;
}