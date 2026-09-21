import { Request, Response } from 'express';
import { Staff }             from '../models/staff.model.js';
import {
  CreateStaffDto,
  UpdateStaffDto,
  validateCreateStaffDto,
  validateUpdateStaffDto,
} from '../dtos/staff-salary.dto.js';

// Helper: auto-generate initials from name
const makeInitials = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');

// ─── GET /api/staff ───────────────────────────────────────────────────────────
export const getAllStaff = async (_req: Request, res: Response): Promise<void> => {
  try {
    const staff = await Staff.find().sort({ createdAt: 1 }).lean();
    // Map _id → id so the frontend shape matches
    const mapped = staff.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch staff', error: (err as Error).message });
  }
};

// ─── POST /api/staff ──────────────────────────────────────────────────────────
export const createStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CreateStaffDto;
    const errors = validateCreateStaffDto(body);
    if (errors.length) { res.status(400).json({ message: errors.join(', ') }); return; }

    const today = new Date().toISOString().slice(0, 10);
    const doc = await Staff.create({
      name:       body.name.trim(),
      role:       body.role?.trim()     ?? 'Hair & Colour',
      initials:   body.initials?.trim() ?? makeInitials(body.name),
      color:      body.color            ?? '#d4af37',
      joinDate:   body.joinDate         ?? today,
      salary:     body.salary           ?? 0,
      salaryMode: body.salaryMode       ?? 'monthly',
    });

    const { _id, ...rest } = doc.toObject();
    res.status(201).json({ id: _id.toString(), ...rest });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create staff', error: (err as Error).message });
  }
};

// ─── PUT /api/staff/:id ───────────────────────────────────────────────────────
export const updateStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body as UpdateStaffDto;
    const errors = validateUpdateStaffDto(body);
    if (errors.length) { res.status(400).json({ message: errors.join(', ') }); return; }

    // If name is being updated, recalculate initials unless explicitly provided
    if (body.name && !body.initials) {
      body.initials = makeInitials(body.name);
    }

    const updated = await Staff.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) { res.status(404).json({ message: 'Staff not found' }); return; }

    const { _id, ...rest } = updated;
    res.json({ id: _id.toString(), ...rest });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update staff', error: (err as Error).message });
  }
};

// ─── DELETE /api/staff/:id ────────────────────────────────────────────────────
export const deleteStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await Staff.findByIdAndDelete(id).lean();
    if (!deleted) { res.status(404).json({ message: 'Staff not found' }); return; }
    res.json({ message: 'Staff deleted', id });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete staff', error: (err as Error).message });
  }
};