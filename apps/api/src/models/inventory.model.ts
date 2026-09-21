import mongoose, { Document, Schema } from 'mongoose';

export type ProductCategory =
  | 'Hair Care'
  | 'Colour & Bleach'
  | 'Skin Care'
  | 'Nail Care'
  | 'Tools & Equipment'
  | 'Disposables'
  | 'Other';

export interface IProduct extends Document {
  name:               string;
  brand:              string;
  category:           ProductCategory;
  sku:                string;
  unit:               string;
  currentStock:       number;
  lowStockThreshold:  number;
  costPrice:          number;
  sellingPrice:       number;
  location:           string;
  notes:              string;
  createdAt:          Date;
  updatedAt:          Date;
}

const productSchema = new Schema<IProduct>(
  {
    name:              { type: String, required: true, trim: true },
    brand:             { type: String, default: '' },
    category:          {
      type: String,
      enum: ['Hair Care','Colour & Bleach','Skin Care','Nail Care',
             'Tools & Equipment','Disposables','Other'],
      default: 'Other',
    },
    sku:               { type: String, default: '' },
    unit:              { type: String, default: 'pcs' },
    currentStock:      { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 10, min: 0 },
    costPrice:         { type: Number, default: 0, min: 0 },
    sellingPrice:      { type: Number, default: 0, min: 0 },
    location:          { type: String, default: '' },
    notes:             { type: String, default: '' },
  },
  { timestamps: true }
);

export const Product = mongoose.model<IProduct>('Product', productSchema);

// ── Purchase Entry ────────────────────────────────────────────────────────────

export interface IPurchaseEntry extends Document {
  productId:   mongoose.Types.ObjectId;
  quantity:    number;
  costPerUnit: number;
  totalCost:   number;
  supplier:    string;
  invoiceNo:   string;
  date:        string;
  notes:       string;
  addedBy:     string;
  createdAt:   Date;
}

const purchaseSchema = new Schema<IPurchaseEntry>(
  {
    productId:   { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity:    { type: Number, required: true, min: 1 },
    costPerUnit: { type: Number, required: true, min: 0 },
    totalCost:   { type: Number, required: true, min: 0 },
    supplier:    { type: String, default: '' },
    invoiceNo:   { type: String, default: '' },
    date:        { type: String, default: () => new Date().toISOString().slice(0, 10) },
    notes:       { type: String, default: '' },
    addedBy:     { type: String, default: 'Admin' },
  },
  { timestamps: true }
);

export const PurchaseEntry = mongoose.model<IPurchaseEntry>('PurchaseEntry', purchaseSchema);

// ── Usage Entry ───────────────────────────────────────────────────────────────

export interface IUsageEntry extends Document {
  productId:  mongoose.Types.ObjectId;
  quantity:   number;
  reason:     string;
  serviceRef: string;
  date:       string;
  notes:      string;
  createdAt:  Date;
}

const usageSchema = new Schema<IUsageEntry>(
  {
    productId:  { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity:   { type: Number, required: true, min: 1 },
    reason:     {
      type: String,
      enum: ['service','damaged','expired','sample','other'],
      default: 'service',
    },
    serviceRef: { type: String, default: '' },
    date:       { type: String, default: () => new Date().toISOString().slice(0, 10) },
    notes:      { type: String, default: '' },
  },
  { timestamps: true }
);

export const UsageEntry = mongoose.model<IUsageEntry>('UsageEntry', usageSchema);