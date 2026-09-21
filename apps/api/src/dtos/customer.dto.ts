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
  referredBy?: string;
  tags?: string[];
  notes?: string;
}

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

export interface AddVisitDto {
  date: string;
  services: string[];
  staff?: string;
  total: number;
  notes?: string;
}

export interface AddServiceRecordDto {
  date: string;
  service: string;
  staff?: string;
  duration?: number;
  price: number;
  rating?: number;
}

export interface AddReferralDto {
  referredName: string;
  referredPhone: string;
  date?: string;
  reward?: number;
}

export interface UpdateReferralStatusDto {
  status: 'pending' | 'converted' | 'credited';
}

export interface CustomerQueryDto {
  q?: string;
  tier?: 'none' | 'silver' | 'gold' | 'platinum';
  page?: string;
  limit?: string;
}
