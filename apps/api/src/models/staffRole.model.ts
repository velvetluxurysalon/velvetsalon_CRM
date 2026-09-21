import { Schema, model, Document } from 'mongoose';

export type StaffRoleType =
  | 'admin'
  | 'manager'
  | 'senior_stylist'
  | 'stylist'
  | 'receptionist'
  | 'support';

export type StaffRoleStatus = 'active' | 'on_leave' | 'inactive';

export interface IStaffRoleMember extends Document {
  name: string;
  phone: string;
  email: string;
  role: StaffRoleType;
  speciality: string;
  status: StaffRoleStatus;
  joinDate: string;
  exitDate: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const staffRoleSchema = new Schema<IStaffRoleMember>(
  {
    name:  { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    role: {
      type: String,
      enum: ['admin', 'manager', 'senior_stylist', 'stylist', 'receptionist', 'support'],
      default: 'stylist',
    },
    speciality: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['active', 'on_leave', 'inactive'],
      default: 'active',
    },
    joinDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    exitDate: { type: String, default: '' },
    notes:    { type: String, default: '' },
  },
  { timestamps: true, collection: 'staffroles' },
);

export const StaffRoleMember = model<IStaffRoleMember>('StaffRoleMember', staffRoleSchema);