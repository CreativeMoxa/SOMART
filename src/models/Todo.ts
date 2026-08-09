import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { auditFields } from "@/lib/auditFields";
import { TODO_TYPES, itemUnits } from "@/lib/todoList";

// A business to-do list: a titled objective (e.g. "Restock sunglasses") with a
// type, a deadline, and a checklist of quantity-based items ("40 orders").
const todoItemSchema = new Schema(
  {
    title: { type: String, default: "" },
    target: { type: Number, default: 1, min: 1 }, // units needed (e.g. 40 orders)
    doneCount: { type: Number, default: 0, min: 0 }, // units finished
    done: { type: Boolean, default: false },
  },
  { _id: true }
);

const todoSchema = new Schema(
  {
    ...auditFields,
    number: { type: String, required: true, unique: true }, // TODO-0001
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: TODO_TYPES, default: "general" },
    notes: { type: String, default: "" },
    dueDate: { type: String, default: "" }, // YYYY-MM-DD
    items: { type: [todoItemSchema], default: [] },
    archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

todoSchema.index({ createdAt: -1 });

// Keep each item's done/target within bounds and its `done` flag in sync, so
// the team just records how many units are finished.
todoSchema.pre("save", function () {
  for (const it of this.items) {
    const { done, target } = itemUnits(it);
    it.target = target;
    it.doneCount = done;
    it.done = done >= target;
  }
});

export type TodoDoc = InferSchemaType<typeof todoSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Todo: Model<TodoDoc> =
  mongoose.models.Todo || mongoose.model<TodoDoc>("Todo", todoSchema);
