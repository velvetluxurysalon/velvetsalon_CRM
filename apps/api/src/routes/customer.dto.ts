// ─── Create Customer DTO ──────────────────────────────────────────────────────

export interface CreateCustomerDto {
  name: string;
  phone: string;
  email?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  joinDate?: string;
  loyaltyPoints?: number;
  membershipTier?: 'none' | 'silver' | 'gold' | 'platinum';
  membershipExpiry?: string;
  referredBy?: string;   // form sends referral code string here
  tags?: string[];
  notes?: string;
}

// ─── Update Customer DTO ──────────────────────────────────────────────────────

export interface UpdateCustomerDto {
  name?: string;
  phone?: string;
  email?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  joinDate?: string;
  loyaltyPoints?: number;
  membershipTier?: 'none' | 'silver' | 'gold' | 'platinum';
  membershipExpiry?: string;
  referredBy?: string;
  tags?: string[];
  notes?: string;
}

// ─── Add Visit DTO ────────────────────────────────────────────────────────────

export interface AddVisitDto {
  date: string;
  services: string[];
  staff?: string;
  total: number;
  notes?: string;
}

// ─── Add Service Record DTO ───────────────────────────────────────────────────

export interface AddServiceRecordDto {
  date: string;
  service: string;
  staff?: string;
  duration?: number;
  price: number;
  rating?: number;
}

// ─── Add Referral DTO ─────────────────────────────────────────────────────────

export interface AddReferralDto {
  referredName: string;
  referredPhone: string;
  date?: string;
  reward?: number;
}

// ─── Update Referral Status DTO ───────────────────────────────────────────────

export interface UpdateReferralStatusDto {
  status: 'pending' | 'converted' | 'credited';
}

// ─── Query DTO ────────────────────────────────────────────────────────────────

export interface CustomerQueryDto {
  q?: string;
  tier?: 'none' | 'silver' | 'gold' | 'platinum';
  page?: string;
  limit?: string;
}