import { Schema, model } from 'mongoose';

const dailyExpenseSchema = new Schema(
  {
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    category: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ['cash', 'card', 'upi'], default: 'cash' },
    createdBy: { type: String, default: '' },
  },
  { timestamps: true },
);

export const DailyExpense = model('DailyExpense', dailyExpenseSchema);
