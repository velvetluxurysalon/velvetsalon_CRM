export interface BillItemDto {
  serviceId:   string;
  serviceName: string;
  staffId:     string;
  price:       number;
  duration:    number;
}

export interface CreateBillDto {
  phone:              string;
  customerName?:      string;
  customerId?:        string;
  items:              BillItemDto[];
  subtotal:           number;
  membershipDiscount: number;
  discountType:       'percent' | 'flat';
  discountValue:      number;
  discountAmount:     number;
  loyaltyRedeemed:    number;
  total:              number;
  paymentMethod:      'cash' | 'card' | 'upi';
  status:             'paid' | 'pending';
  notes?:             string;
  date?:              string;
  appointmentId?:     string;   // ← added: links bill back to the source appointment
  couponCode?: string;   // ← add
}

export interface BillQueryDto {
  limit?: string;
}

export function validateCreateBillDto(body: Partial<CreateBillDto>): string[] {
  const errors: string[] = [];
  if (!body.phone)                                        errors.push('phone is required');
  if (!Array.isArray(body.items) || !body.items.length)  errors.push('items must be a non-empty array');
  if (typeof body.total !== 'number')                    errors.push('total must be a number');
  if (!body.paymentMethod || !['cash','card','upi'].includes(body.paymentMethod))      errors.push('invalid paymentMethod');
  if (!body.status || !['paid','pending'].includes(body.status))                errors.push('invalid status');
  return errors;
}