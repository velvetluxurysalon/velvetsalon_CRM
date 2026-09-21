import mongoose, { type Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type Role = 'admin' | 'receptionist' | 'staff';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role:     { type: String, enum: ['admin', 'receptionist', 'staff'], default: 'staff' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  if (!this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Instance method to compare passwords
UserSchema.methods.comparePassword = async function (this: IUser, candidate: string): Promise<boolean> {
  const storedPassword = this.password;
  if (!storedPassword) return false;
  return bcrypt.compare(candidate, storedPassword);
};

// Never send password in JSON responses
UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', UserSchema);