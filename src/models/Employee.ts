import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ROLES } from "@/lib/roles";

export const EMPLOYEE_STATUSES = ["active", "inactive", "suspended"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

const employeeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, default: "" },
    photoUrl: { type: String, default: "" },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: EMPLOYEE_STATUSES, default: "active", index: true },

    // Set when the employee completes registration (email OTP → password).
    passwordHash: { type: String, default: "" },
    registeredAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },

    // Device restriction. ON = may stay signed in on several devices.
    // OFF = only the newest session survives; older ones are terminated.
    allowMultipleDevices: { type: Boolean, default: true },
    // Bumping this invalidates every existing token for this employee
    // (used on suspend/deactivate/delete/password change).
    sessionVersion: { type: Number, default: 0 },
    // The newest session id — enforced only when allowMultipleDevices is off.
    currentSessionId: { type: String, default: "" },

    // Audit
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export type EmployeeDoc = InferSchemaType<typeof employeeSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Employee: Model<EmployeeDoc> =
  mongoose.models.Employee || mongoose.model<EmployeeDoc>("Employee", employeeSchema);

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

// Make sure a Founder & CEO always exists so the owner can register and manage
// the team. Idempotent — does nothing once any CEO is present, so the address
// can be changed later from the Employees module.
export async function ensureFounderCeo() {
  const existing = await Employee.findOne({ role: "founder-ceo" });
  if (existing) return existing;
  const email = normalizeEmail(
    process.env.FOUNDER_EMAIL || "mohamedalitahir5@gmail.com"
  );
  const alreadyByEmail = await Employee.findOne({ email });
  if (alreadyByEmail) {
    alreadyByEmail.role = "founder-ceo";
    alreadyByEmail.status = "active";
    await alreadyByEmail.save();
    return alreadyByEmail;
  }
  return Employee.create({
    name: process.env.FOUNDER_NAME || "Mohamed Ali Dahir",
    email,
    role: "founder-ceo",
    status: "active",
    allowMultipleDevices: true,
    createdBy: "system",
    updatedBy: "system",
  });
}

// An employee may sign in only when they are active AND have finished
// registering (i.e. they have a password).
export function canSignIn(e: Pick<EmployeeDoc, "status" | "passwordHash">) {
  return e.status === "active" && Boolean(e.passwordHash);
}
