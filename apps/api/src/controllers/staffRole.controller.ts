import type { Request, Response, NextFunction } from 'express';
import { StaffRoleMember } from '../models/staffRole.model.js';
import type {
  CreateStaffRoleDto,
  UpdateStaffRoleDto,
  StaffRoleQueryDto,
} from '../dtos/staffRole.dto.js';

export const listStaffRoles = async (
  req: Request<unknown, unknown, unknown, StaffRoleQueryDto>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { q, role, status } = req.query;
    const filter: Record<string, unknown> = {};
    if (role && role !== 'all') filter.role = role;
    if (status && status !== 'all') filter.status = status;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }
    const members = await StaffRoleMember.find(filter).sort({ createdAt: -1 });
    return res.json(members);
  } catch (err) {
    next(err); return;
  }
};

export const createStaffRole = async (
  req: Request<unknown, unknown, CreateStaffRoleDto>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, phone } = req.body;
    if (!name?.trim() || !phone?.trim()) {
      return res.status(400).json({ message: 'Name and phone are required.' });
    }
    const created = await StaffRoleMember.create(req.body);
    return res.status(201).json(created);
  } catch (err) {
    next(err); return;
  }
};

export const updateStaffRole = async (
  req: Request<{ id: string }, unknown, UpdateStaffRoleDto>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const updated = await StaffRoleMember.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: 'Staff member not found.' });
    return res.json(updated);
  } catch (err) {
    next(err); return;
  }
};

export const deleteStaffRole = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const deleted = await StaffRoleMember.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Staff member not found.' });
    return res.json({ message: 'Staff member removed.' });
  } catch (err) {
    next(err); return;
  }
};