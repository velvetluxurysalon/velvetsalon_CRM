import { Request, Response } from 'express';
import { ServiceMap } from '../models/serviceMap.model.js';

const withId = (doc: Record<string, unknown>) => ({ ...doc, _id: doc._id?.toString() });

export const getServiceMap = async (_req: Request, res: Response): Promise<void> => {
  try {
    const entries = await ServiceMap.find().lean();
    res.json(entries.map(e => withId(e as unknown as Record<string, unknown>)));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch service map', error: (err as Error).message });
  }
};

export const upsertServiceMap = async (req: Request, res: Response): Promise<void> => {
  try {
    const { serviceId, serviceName, consumables } = req.body as {
      serviceId?: string;
      serviceName?: string;
      consumables?: { productName: string; quantity: number; unit: string }[];
    };

    if (!serviceId?.trim()) { res.status(400).json({ message: 'serviceId is required' }); return; }

    const entry = await ServiceMap.findOneAndUpdate(
      { serviceId },
      { $set: { serviceName: serviceName ?? serviceId, consumables: consumables ?? [] } },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    res.status(200).json(withId(entry as unknown as Record<string, unknown>));
  } catch (err) {
    res.status(500).json({ message: 'Failed to save service map', error: (err as Error).message });
  }
};