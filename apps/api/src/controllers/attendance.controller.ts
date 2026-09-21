import { Request, Response }    from 'express';
import { Attendance }           from '../models/attendance.model.js';
import {
  AttendanceQueryDto,
  UpsertAttendanceDto,
  validateUpsertAttendanceDto,
} from '../dtos/attendance.dto.js';

// ─── GET /api/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD ───────────────────────

export const getAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query as AttendanceQueryDto;

    const filter: Record<string, unknown> = {};

    if (from && to) {
      filter.date = { $gte: from, $lte: to };
    } else if (from) {
      filter.date = { $gte: from };
    } else if (to) {
      filter.date = { $lte: to };
    }

    const records = await Attendance.find(filter)
      .sort({ date: 1, staffId: 1 })
      .lean();

    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch attendance', error: (err as Error).message });
  }
};

// ─── POST /api/attendance ─────────────────────────────────────────────────────
// Upserts: one record per staffId+date. Clicking in the heatmap calls this
// repeatedly as status cycles — the unique index + findOneAndUpdate handles it.

export const upsertAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as UpsertAttendanceDto;

    const errors = validateUpsertAttendanceDto(body);
    if (errors.length) {
      res.status(400).json({ message: errors.join(', ') });
      return;
    }

    const { staffId, date, status, checkIn, checkOut, notes } = body;

    const record = await Attendance.findOneAndUpdate(
      { staffId: staffId.trim(), date },
      {
        $set: {
          status,
          checkIn:  checkIn  ?? '',
          checkOut: checkOut ?? '',
          notes:    notes    ?? '',
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    res.status(200).json(record);
  } catch (err) {
    res.status(500).json({ message: 'Failed to save attendance', error: (err as Error).message });
  }
};