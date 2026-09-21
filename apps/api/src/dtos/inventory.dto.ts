import { ProductCategory } from '../models/inventory.model.js';

export interface CreateProductDto {
  name:               string;
  brand?:             string;
  category?:          ProductCategory;
  sku?:               string;
  unit?:              string;
  currentStock?:      number;
  lowStockThreshold?: number;
  costPrice?:         number;
  sellingPrice?:      number;
  location?:          string;
  notes?:             string;
}

export type UpdateProductDto = Partial<CreateProductDto>;

export function validateCreateProductDto(body: Partial<CreateProductDto>): string[] {
  const errors: string[] = [];
  if (!body.name?.trim())                                           errors.push('name is required');
  if (body.currentStock     !== undefined && body.currentStock < 0)     errors.push('currentStock cannot be negative');
  if (body.lowStockThreshold !== undefined && body.lowStockThreshold < 0) errors.push('lowStockThreshold cannot be negative');
  if (body.costPrice         !== undefined && body.costPrice < 0)        errors.push('costPrice cannot be negative');
  return errors;
}

export interface CreatePurchaseDto {
  quantity:    number;
  costPerUnit: number;
  supplier?:   string;
  invoiceNo?:  string;
  date?:       string;
  notes?:      string;
}

export function validateCreatePurchaseDto(body: Partial<CreatePurchaseDto>): string[] {
  const errors: string[] = [];
  if (!body.quantity || body.quantity < 1)                errors.push('quantity must be >= 1');
  if (body.costPerUnit === undefined || body.costPerUnit < 0) errors.push('costPerUnit must be >= 0');
  return errors;
}

export interface CreateUsageDto {
  quantity:    number;
  reason?:     string;
  serviceRef?: string;
  date?:       string;
  notes?:      string;
}

export function validateCreateUsageDto(body: Partial<CreateUsageDto>): string[] {
  const errors: string[] = [];
  if (!body.quantity || body.quantity < 1) errors.push('quantity must be >= 1');
  return errors;
}

export interface ProductQueryDto {
  search?:   string;
  category?: string;
  status?:   string;
  limit?:    string;
  page?:     string;
}