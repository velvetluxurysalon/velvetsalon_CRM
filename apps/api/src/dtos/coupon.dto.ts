export interface CreateCouponDto {
  code:           string;
  discountType:   'percent' | 'flat';
  discountValue:  number;
  description?:   string;
  expiryDate?:    string | null;
  active?:        boolean;
  customerPhone?: string | null;   // ← added: 10-digit phone, or null/undefined for a public coupon
}

export type UpdateCouponDto = Partial<CreateCouponDto>;

export interface ValidateCouponDto {
  code:          string;
  amount:        number;
  customerPhone?: string;   // ← added: Billing page sends the phone it looked up
}

export function validateCreateCouponDto(body: Partial<CreateCouponDto>): string[] {
  const errors: string[] = [];
  if (!body.code || !body.code.trim())                    errors.push('code is required');
  if (!body.discountType || !['percent', 'flat'].includes(body.discountType))   errors.push('discountType must be "percent" or "flat"');
  if (typeof body.discountValue !== 'number' || body.discountValue <= 0)
    errors.push('discountValue must be a positive number');
  if (body.discountType === 'percent' && (body.discountValue ?? 0) > 100)
    errors.push('percent discountValue cannot exceed 100');
 if (body.expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.expiryDate))
    errors.push('expiryDate must be in YYYY-MM-DD format');
  if (body.customerPhone && !/^\d{10}$/.test(body.customerPhone))
    errors.push('customerPhone must be a 10-digit number');
  return errors;
}

export function validateValidateCouponDto(body: Partial<ValidateCouponDto>): string[] {
  const errors: string[] = [];
  if (!body.code || !body.code.trim())                     errors.push('code is required');
  if (typeof body.amount !== 'number' || body.amount < 0)  errors.push('amount must be a non-negative number');
  return errors;
}