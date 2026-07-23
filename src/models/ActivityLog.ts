import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ROLES, type ModuleKey, type Role } from "@/lib/roles";

// Rolling 7-day record of what each employee did. Entries delete themselves
// via a Mongo TTL index — nothing is kept permanently.
const RETENTION_DAYS = 7;

const activityLogSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    employeeName: { type: String, default: "" },
    employeeRole: { type: String, enum: ROLES, required: true },
    // Human sentence, e.g. "created Invoice INV-1024".
    action: { type: String, required: true },
    module: { type: String, default: "" },
    // Optional reference to the touched record (number or id).
    reference: { type: String, default: "" },
    device: { type: String, default: "" },
    ip: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Automatic cleanup: Mongo drops entries older than the retention window.
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

export type ActivityLogDoc = InferSchemaType<typeof activityLogSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const ActivityLog: Model<ActivityLogDoc> =
  mongoose.models.ActivityLog ||
  mongoose.model<ActivityLogDoc>("ActivityLog", activityLogSchema);

export type LogInput = {
  employeeId?: mongoose.Types.ObjectId | string | null;
  employeeName?: string;
  employeeRole: Role;
  action: string;
  module?: ModuleKey | string;
  reference?: string;
  device?: string;
  ip?: string;
};

// Never let logging break the action it is recording.
export async function logActivity(entry: LogInput) {
  try {
    await ActivityLog.create({
      employeeId: entry.employeeId ?? null,
      employeeName: entry.employeeName ?? "",
      employeeRole: entry.employeeRole,
      action: entry.action,
      module: entry.module ?? "",
      reference: entry.reference ?? "",
      device: entry.device ?? "",
      ip: entry.ip ?? "",
    });
  } catch (err) {
    console.error("logActivity failed:", err);
  }
}
