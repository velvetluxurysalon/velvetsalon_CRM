import { Request, Response } from 'express';
import { Customer } from '../models/customer.model.js';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  AddVisitDto,
  AddServiceRecordDto,
  AddReferralDto,
  UpdateReferralStatusDto,
  CustomerQueryDto,
} from '../dtos/customer.dto.js';

// ─── GET /api/customers ───────────────────────────────────────────────────────

export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, tier } = req.query as CustomerQueryDto;

    const filter: Record<string, unknown> = {};

    if (q) {
      filter.$or = [
        { name:  { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }

    if (tier) {
      filter.membershipTier = tier;
    }

    const customers = await Customer.find(filter)
      .select('-visits -services -referrals')
      .sort({ createdAt: -1 })
      .lean();

    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customers', error: (err as Error).message });
  }
};

// ─── GET /api/customers/:id ───────────────────────────────────────────────────

export const getCustomerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await Customer.findById(req.params.id).lean();

    if (!customer) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customer', error: (err as Error).message });
  }
};

// ─── POST /api/customers ──────────────────────────────────────────────────────

export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CreateCustomerDto;

    // Normalize enum fields to lowercase before Mongoose validation
    if (body.gender !== undefined) {
  body.gender = body.gender.toLowerCase() as 'male' | 'female' | 'other';
}
    if (body.membershipTier !== undefined) {
  body.membershipTier = body.membershipTier.toLowerCase() as 'none' | 'silver' | 'gold' | 'platinum';
}

    // Pull out the referral code string BEFORE passing body to Mongoose
    // (schema's referredBy field is ObjectId — passing a string causes a cast error)
    const referredByCode = body.referredBy ?? '';
const bodyWithoutReferral = { ...body };
delete bodyWithoutReferral.referredBy;

    // Look up referrer and push referral record onto their document
    if (referredByCode) {
      const referrer = await Customer.findOne({ referralCode: referredByCode.toUpperCase() });
      if (referrer) {
        const today = new Date().toISOString().slice(0, 10);
        referrer.referrals.push({
          referredName:  body.name,
          referredPhone: body.phone,
          date:          today,
          status:        'pending',
          reward:        100,
        } as never);
        await referrer.save();
      }
    }

    // Store the code string in the correct schema field: referredByCode
    const customer = await Customer.create({ ...bodyWithoutReferral, referredByCode });
    res.status(201).json(customer);
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg.includes('duplicate key') || msg.includes('E11000')) {
      res.status(409).json({ message: 'A customer with this phone number already exists.' });
      return;
    }
    res.status(500).json({ message: msg });
  }
};

// ─── PUT /api/customers/:id ───────────────────────────────────────────────────

export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as UpdateCustomerDto;

    // Normalize enum fields to lowercase
    if (body.gender !== undefined) {
  body.gender = body.gender.toLowerCase() as 'male' | 'female' | 'other';
}
    if (body.membershipTier !== undefined) {
  body.membershipTier = body.membershipTier.toLowerCase() as 'none' | 'silver' | 'gold' | 'platinum';
}

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean();

    if (!customer) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update customer', error: (err as Error).message });
  }
};

// ─── DELETE /api/customers/:id ────────────────────────────────────────────────

export const deleteCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);

    if (!customer) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete customer', error: (err as Error).message });
  }
};

// ─── POST /api/customers/:id/visits ──────────────────────────────────────────

export const addVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as AddVisitDto;

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    customer.visits.push(body as never);

    // ✅ Fix 2: Use correct schema field names (visitCount / totalSpent)
    customer.visitCount   = customer.visits.length;
    customer.totalSpent  += body.total;
    customer.lastVisit    = body.date;

    // Award 1 loyalty point per ₹10 spent
    customer.loyaltyPoints += Math.floor(body.total / 10);

    await customer.save();
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add visit', error: (err as Error).message });
  }
};

// ─── POST /api/customers/:id/services ────────────────────────────────────────

export const addServiceRecord = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as AddServiceRecordDto;

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    customer.services.push(body as never);
    await customer.save();

    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add service record', error: (err as Error).message });
  }
};

// ─── POST /api/customers/:id/referrals ───────────────────────────────────────

export const addReferral = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as AddReferralDto;

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    customer.referrals.push({
      ...body,
      date:   body.date ?? new Date().toISOString().slice(0, 10),
      status: 'pending',
      reward: body.reward ?? 100,
    } as never);

    await customer.save();
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add referral', error: (err as Error).message });
  }
};

// ─── PATCH /api/customers/:id/referrals/:referralId/status ───────────────────

export const updateReferralStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body as UpdateReferralStatusDto;

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    const referral = customer.referrals.find(
  (r) => r._id.toString() === req.params.referralId
);
    if (!referral) {
      res.status(404).json({ message: 'Referral not found' });
      return;
    }

    referral.status = status;

    if (status === 'credited') {
      customer.loyaltyPoints += referral.reward;
    }

    await customer.save();
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update referral status', error: (err as Error).message });
  }
};

// ─── PATCH /api/customers/:id/loyalty ────────────────────────────────────────

export const adjustLoyaltyPoints = async (req: Request, res: Response): Promise<void> => {
  try {
    const { points, action } = req.body as { points: number; action: 'add' | 'redeem' };

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    if (action === 'add') {
      customer.loyaltyPoints += points;
    } else {
      if (customer.loyaltyPoints < points) {
        res.status(400).json({ message: 'Insufficient loyalty points' });
        return;
      }
      customer.loyaltyPoints -= points;
    }

    await customer.save();
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to adjust loyalty points', error: (err as Error).message });
  }
};

// ─── PATCH /api/customers/:id/membership ─────────────────────────────────────

export const updateMembership = async (req: Request, res: Response): Promise<void> => {
  try {
    const { membershipTier, membershipExpiry } = req.body as {
      membershipTier: 'none' | 'silver' | 'gold' | 'platinum';
      membershipExpiry?: string;
    };

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: { membershipTier: membershipTier.toLowerCase(), membershipExpiry: membershipExpiry ?? '' } },
      { new: true, runValidators: true }
    ).lean();

    if (!customer) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update membership', error: (err as Error).message });
  }
};