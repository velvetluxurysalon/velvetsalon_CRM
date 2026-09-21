import { Request, Response, NextFunction } from 'express';
import { EmployeeJoining, IEmployeeJoining } from '../models/EmployeeJoining.model.js';

export const createEmployeeJoining = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = req.body as Partial<IEmployeeJoining>;
    const doc = await EmployeeJoining.create({
      ...body,
      // omit the key entirely when there's no user id, instead of setting it to undefined
      ...(req.user?.id ? { createdBy: req.user.id } : {}),
    });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
};

export const listEmployeeJoinings = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Aadhaar/PAN/bank fields are excluded by the schema's `select: false`
    // — use getEmployeeJoiningById to pull the full record for one person.
    const docs = await EmployeeJoining.find().sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    next(err);
  }
};

export const getEmployeeJoiningById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const doc = await EmployeeJoining.findById(req.params.id).select(
      '+aadhaarNumber +panNumber +bankName +accountHolderName +accountNumber +ifscCode'
    );
    if (!doc) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.json(doc);
  } catch (err) {
    next(err); return;
  }
};

// NEW ─────────────────────────────────────────────────────────────────────
export const updateEmployeeJoining = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = req.body as Partial<IEmployeeJoining>;

    // createdBy / declarationAccepted are set at creation time only —
    // strip them (and _id) out so an edit can't silently reassign
    // ownership or flip the declaration flag.
   const updatable = { ...body } as Record<string, unknown>;
delete updatable.createdBy;
delete updatable.declarationAccepted;
delete updatable._id;

    const doc = await EmployeeJoining.findByIdAndUpdate(
      req.params.id,
      { $set: updatable },
      { new: true, runValidators: true }
    ).select(
      '+aadhaarNumber +panNumber +bankName +accountHolderName +accountNumber +ifscCode'
    );

    if (!doc) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.json(doc);
  } catch (err) {
    next(err); return;
  }
};

export const deleteEmployeeJoining = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const doc = await EmployeeJoining.findByIdAndDelete(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(204).send();
  } catch (err) {
    next(err); return;
  }
};