import type { Request, Response, NextFunction } from 'express';
import { DailyExpense } from '../models/DailyExpense.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const METHODS = ['cash', 'card', 'upi'] as const;
type Method = (typeof METHODS)[number];

// ⚠ Match this to how your auth middleware attaches the user (check bill.controller.ts)
type AuthedReq = Request & { user?: { name?: string; role?: string } };

// GET /api/daily-expenses?from=YYYY-MM-DD&to=YYYY-MM-DD&category=Cleaning
export const getExpenses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to, category } = req.query as Record<string, string | undefined>;
    const filter: Record<string, unknown> = {};

    if (from && to && DATE_RE.test(from) && DATE_RE.test(to)) {
      filter.date = { $gte: from, $lte: to };
    }
    if (category && category !== 'All') filter.category = category;

    const rows = await DailyExpense.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

// POST /api/daily-expenses
export const createExpense = async (req: AuthedReq, res: Response, next: NextFunction) => {
  try {
    const { date, category, description, amount, paymentMethod } = req.body as {
      date?: string;
      category?: string;
      description?: string;
      amount?: number;
      paymentMethod?: Method;
    };

    if (!date || !DATE_RE.test(date) || !category?.trim() || !(Number(amount) > 0)) {
      res.status(400).json({ error: 'date, category and a positive amount are required' });
      return;
    }

    const doc = await DailyExpense.create({
      date,
      category: category.trim(),
      description: description?.trim() ?? '',
      amount: Number(amount),
      paymentMethod: paymentMethod && METHODS.includes(paymentMethod) ? paymentMethod : 'cash',
      createdBy: req.user?.name ?? '',
    });

    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
};

// PATCH /api/daily-expenses/:id
export const updateExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, category, description, amount, paymentMethod } = req.body as Record<
      string,
      unknown
    >;
    const update: Record<string, unknown> = {};

    if (typeof date === 'string' && DATE_RE.test(date)) update.date = date;
    if (typeof category === 'string' && category.trim()) update.category = category.trim();
    if (typeof description === 'string') update.description = description.trim();
    if (amount !== undefined && Number(amount) > 0) update.amount = Number(amount);
    if (typeof paymentMethod === 'string' && METHODS.includes(paymentMethod as Method)) {
      update.paymentMethod = paymentMethod;
    }

    const doc = await DailyExpense.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!doc) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

// DELETE /api/daily-expenses/:id  (admin only)
export const deleteExpense = async (req: AuthedReq, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Only admin can delete expenses' });
      return;
    }

    const doc = await DailyExpense.findByIdAndDelete(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
