import { Request, Response }  from 'express';
import mongoose                from 'mongoose';
import { Product, PurchaseEntry, UsageEntry } from '../models/inventory.model.js';
import {
  CreateProductDto, UpdateProductDto, validateCreateProductDto,
  CreatePurchaseDto, validateCreatePurchaseDto,
  CreateUsageDto,   validateCreateUsageDto,
  ProductQueryDto,
} from '../dtos/inventory.dto.js';

const todayStr = () => new Date().toISOString().slice(0, 10);

const getStockStatus = (stock: number, threshold: number) => {
  if (stock <= 0)                 return 'out';
  if (stock <= threshold * 0.5)  return 'critical';
  if (stock <= threshold)        return 'low';
  return 'ok';
};

const toId = (id: string) => new mongoose.Types.ObjectId(id);

const withId = (doc: Record<string, unknown>) => ({
  ...doc,
  id: doc._id?.toString(),
});

// ── Products ──────────────────────────────────────────────────────────────────

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, category, status, limit = '100', page = '1' } = req.query as ProductQueryDto;
    const filter: Record<string, unknown> = {};

    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { sku:   { $regex: search, $options: 'i' } },
      ];
    }
    if (category && category !== 'all') filter.category = category;

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const enriched = products.map(p => ({
      ...withId(p as unknown as Record<string, unknown>),
      status: getStockStatus(p.currentStock, p.lowStockThreshold),
    }));

    const result = status && status !== 'all'
      ? enriched.filter(p => p.status === status)
      : enriched;

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch products', error: (err as Error).message });
  }
};

export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) { res.status(404).json({ message: 'Product not found' }); return; }
    res.json({
      ...withId(product as unknown as Record<string, unknown>),
      status: getStockStatus(product.currentStock, product.lowStockThreshold),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch product', error: (err as Error).message });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const body   = req.body as CreateProductDto;
    const errors = validateCreateProductDto(body);
    if (errors.length) { res.status(400).json({ message: errors.join(', ') }); return; }

    const product = await Product.create({
      name:              body.name.trim(),
      brand:             body.brand             ?? '',
      category:          body.category          ?? 'Other',
      sku:               body.sku               ?? '',
      unit:              body.unit              ?? 'pcs',
      currentStock:      body.currentStock      ?? 0,
      lowStockThreshold: body.lowStockThreshold ?? 10,
      costPrice:         body.costPrice         ?? 0,
      sellingPrice:      body.sellingPrice      ?? 0,
      location:          body.location          ?? '',
      notes:             body.notes             ?? '',
    });

    res.status(201).json(withId(product.toObject() as unknown as Record<string, unknown>));
  } catch (err) {
    res.status(500).json({ message: 'Failed to create product', error: (err as Error).message });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const body    = req.body as UpdateProductDto;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean();

    if (!product) { res.status(404).json({ message: 'Product not found' }); return; }
    res.json({
      ...withId(product as unknown as Record<string, unknown>),
      status: getStockStatus(product.currentStock, product.lowStockThreshold),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update product', error: (err as Error).message });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') { res.status(400).json({ message: 'Invalid product ID.' }); return; }

    const product = await Product.findByIdAndDelete(id);
    if (!product) { res.status(404).json({ message: 'Product not found' }); return; }

    await Promise.all([
      PurchaseEntry.deleteMany({ productId: toId(id) }),
      UsageEntry.deleteMany({   productId: toId(id) }),
    ]);

    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete product', error: (err as Error).message });
  }
};

// ── Purchases ─────────────────────────────────────────────────────────────────

export const getPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, limit = '50' } = req.query as { productId?: string; limit?: string };
    const filter = productId ? { productId: toId(productId) } : {};

    const entries = await PurchaseEntry.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json(entries.map(e => ({
      ...withId(e as unknown as Record<string, unknown>),
      productId: e.productId.toString(),
    })));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch purchases', error: (err as Error).message });
  }
};

export const addPurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) { res.status(404).json({ message: 'Product not found' }); return; }

    const body   = req.body as CreatePurchaseDto;
    const errors = validateCreatePurchaseDto(body);
    if (errors.length) { res.status(400).json({ message: errors.join(', ') }); return; }

    const qty = body.quantity;
    const cpu = body.costPerUnit;

    const entry = await PurchaseEntry.create({
      productId:   product._id,
      quantity:    qty,
      costPerUnit: cpu,
      totalCost:   qty * cpu,
      supplier:    body.supplier  ?? '',
      invoiceNo:   body.invoiceNo ?? '',
      date:        body.date      ?? todayStr(),
      notes:       body.notes     ?? '',
      addedBy:     'Admin',
    });

    product.currentStock += qty;
    product.costPrice     = cpu;
    await product.save();

    res.status(201).json({
      entry: {
        ...withId(entry.toObject() as unknown as Record<string, unknown>),
        productId: product._id.toString(),
      },
      product: {
        ...withId(product.toObject() as unknown as Record<string, unknown>),
        status: getStockStatus(product.currentStock, product.lowStockThreshold),
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add purchase', error: (err as Error).message });
  }
};

// ── Usage ─────────────────────────────────────────────────────────────────────

export const getUsage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, limit = '50' } = req.query as { productId?: string; limit?: string };
    const filter = productId ? { productId: toId(productId) } : {};

    const entries = await UsageEntry.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json(entries.map(e => ({
      ...withId(e as unknown as Record<string, unknown>),
      productId: e.productId.toString(),
    })));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch usage', error: (err as Error).message });
  }
};

export const addUsage = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) { res.status(404).json({ message: 'Product not found' }); return; }

    const body   = req.body as CreateUsageDto;
    const errors = validateCreateUsageDto(body);
    if (errors.length) { res.status(400).json({ message: errors.join(', ') }); return; }

        const qty = body.quantity;

    const entry = await UsageEntry.create({
      productId:  product._id,
      quantity:   qty,
      reason:     body.reason     ?? 'service',
      serviceRef: body.serviceRef ?? '',
      date:       body.date       ?? todayStr(),
      notes:      body.notes      ?? '',
    });

    product.currentStock = Math.max(0, product.currentStock - qty);
    await product.save();

    res.status(201).json({
      entry: {
        ...withId(entry.toObject() as unknown as Record<string, unknown>),
        productId: product._id.toString(),
      },
      product: {
        ...withId(product.toObject() as unknown as Record<string, unknown>),
        status: getStockStatus(product.currentStock, product.lowStockThreshold),
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to log usage', error: (err as Error).message });
  }
};

// ── Alerts & Stats ────────────────────────────────────────────────────────────

export const getAlerts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await Product.find().lean();
    const alerts   = products
      .map(p => ({
        ...withId(p as unknown as Record<string, unknown>),
        status: getStockStatus(p.currentStock, p.lowStockThreshold),
      }))
      .filter(p => p.status !== 'ok')
      .sort((a, b) => {
        const rank: Record<string, number> = { out: 0, critical: 1, low: 2 };
        return (rank[a.status] ?? 0) - (rank[b.status] ?? 0);
      });

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch alerts', error: (err as Error).message });
  }
};

export const getStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const products  = await Product.find().lean();
    const monthStr  = new Date().toISOString().slice(0, 7);
    const purchases = await PurchaseEntry.find({ date: { $regex: `^${monthStr}` } }).lean();

    const totalValue = products.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0);
    const byStatus   = products.reduce<Record<string, number>>((acc, p) => {
      const s = getStockStatus(p.currentStock, p.lowStockThreshold);
      acc[s]  = (acc[s] || 0) + 1;
      return acc;
    }, {});

    res.json({
      totalProducts:          products.length,
      totalStockValue:        totalValue,
      purchasedThisMonth:     purchases.reduce((s, p) => s + p.totalCost, 0),
      purchaseCountThisMonth: purchases.length,
      byStatus,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stats', error: (err as Error).message });
  }
};