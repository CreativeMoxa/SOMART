import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { auditFields } from "@/lib/auditFields";
import { TASK_STATUSES, PRIORITIES, RECURRENCES, CHECKLIST_STATUSES } from "@/lib/taskManager";

// A single unit of work. Subtasks/checklist items, comments and the activity
// history live embedded on the task so it stays one self-contained record.
// Each checklist item has its own status (default Not Started); `done` is kept
// in sync for any legacy readers.
const subtaskSchema = new Schema(
  {
    title: { type: String, default: "" },
    status: { type: String, enum: CHECKLIST_STATUSES, default: "not-started" },
    done: { type: Boolean, default: false },
  },
  { _id: true }
);

const commentSchema = new Schema(
  {
    author: { type: String, default: "" },
    text: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const activitySchema = new Schema(
  {
    actor: { type: String, default: "" },
    action: { type: String, default: "" }, // e.g. "created", "moved to In Progress"
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const attachmentSchema = new Schema(
  {
    name: { type: String, default: "" },
    url: { type: String, default: "" },
    kind: { type: String, default: "" }, // pdf / image / excel / other
  },
  { _id: false }
);

const taskSchema = new Schema(
  {
    number: { type: String, required: true, unique: true }, // TSK-0001
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, default: "General" },
    department: { type: String, default: "management" },
    priority: { type: String, enum: PRIORITIES, default: "medium", index: true },
    status: { type: String, enum: TASK_STATUSES, default: "not-started", index: true },

    // Assignment — one or more employees (stored by name for simple display;
    // ids kept in parallel for scoping "my tasks").
    assignees: { type: [String], default: [] },
    assigneeIds: { type: [String], default: [] },

    startDate: { type: String, default: "" }, // YYYY-MM-DD
    dueDate: { type: String, default: "", index: true },
    estimatedDate: { type: String, default: "" }, // estimated completion
    completedDate: { type: String, default: "" }, // set when marked completed
    progress: { type: Number, default: 0, min: 0, max: 100 },

    subtasks: { type: [subtaskSchema], default: [] },
    comments: { type: [commentSchema], default: [] },
    activity: { type: [activitySchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    internalNotes: { type: String, default: "" },

    // Recurring config: when a recurring task is completed, the next one is
    // spawned automatically. `every` is the interval in days for "custom".
    recurrence: { type: String, enum: RECURRENCES, default: "none" },
    recurEvery: { type: Number, default: 0 },

    // Reusable template — excluded from the normal task lists/board.
    isTemplate: { type: Boolean, default: false, index: true },
    // Archived tasks are hidden from active views but never deleted.
    archived: { type: Boolean, default: false, index: true },

    ...auditFields,
  },
  { timestamps: true }
);

taskSchema.index({ createdAt: -1 });
taskSchema.index({ status: 1, dueDate: 1 });

export type TaskDoc = InferSchemaType<typeof taskSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Task: Model<TaskDoc> =
  mongoose.models.Task || mongoose.model<TaskDoc>("Task", taskSchema);
