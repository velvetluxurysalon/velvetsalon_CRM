import { Request, Response } from 'express';
import { SalaryCredit }      from '../models/salary.model.js';
import {
  CreateSalaryCreditDto,
  validateCreateSalaryCreditDto,
} from '../dtos/staff-salary.dto.js';

// ─── GET /api/salary?staffId= ─────────────────────────────────────────────────
export const getSalaryCredits = async (req: Request, res: Response): Promise<void> => {
  try {
    const { staffId } = req.query as { staffId?: string };
    const filter: Record<string, unknown> = {};
    if (staffId) filter.staffId = staffId.trim();

    const credits = await SalaryCredit.find(filter).sort({ date: -1 }).lean();
    const mapped  = credits.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch salary credits', error: (err as Error).message });
  }
};

// ─── POST /api/salary ─────────────────────────────────────────────────────────
export const createSalaryCredit = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CreateSalaryCreditDto;
    const errors = validateCreateSalaryCreditDto(body);
    if (errors.length) { res.status(400).json({ message: errors.join(', ') }); return; }

    const doc = await SalaryCredit.create({
      staffId: body.staffId.trim(),
      amount:  body.amount,
      date:    body.date,
      note:    body.note?.trim() ?? '',
      period:  body.period.trim(),
    });

    const { _id, ...rest } = doc.toObject();
    res.status(201).json({ id: _id.toString(), ...rest });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create salary credit', error: (err as Error).message });
  }
};

// ─── DELETE /api/salary/:id ───────────────────────────────────────────────────
export const deleteSalaryCredit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await SalaryCredit.findByIdAndDelete(id).lean();
    if (!deleted) { res.status(404).json({ message: 'Salary credit not found' }); return; }
    res.json({ message: 'Salary credit deleted', id });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete salary credit', error: (err as Error).message });
  }
};