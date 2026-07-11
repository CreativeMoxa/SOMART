import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const EXPENSE_CATEGORIES = [
  "rent",
  "salaries",
  "utilities",
  "marketing",
  "purchases",
  "transport",
  "other",
] as const;

const expenseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, default: "other" },
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export type ExpenseDoc = InferSchemaType<typeof expenseSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Expense: Model<ExpenseDoc> =
  mongoose.models.Expense || mongoose.model<ExpenseDoc>("Expense", expenseSchema);
