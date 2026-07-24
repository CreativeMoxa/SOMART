import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { createHash, randomInt } from "crypto";

export const OTP_PURPOSES = ["register", "reset", "device"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

// One-time codes for registration and password reset. Codes are stored hashed
// and the document self-destructs at expiresAt (Mongo TTL index).
const otpSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    purpose: { type: String, enum: OTP_PURPOSES, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    // Set once the code has been verified, so the caller may finish the flow.
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// TTL: Mongo removes the document once expiresAt passes.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OtpDoc = InferSchemaType<typeof otpSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Otp: Model<OtpDoc> =
  mongoose.models.Otp || mongoose.model<OtpDoc>("Otp", otpSchema);

export function hashCode(code: string) {
  return createHash("sha256").update(String(code)).digest("hex");
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Replace any previous code for this email+purpose and issue a fresh one.
export async function issueOtp(email: string, purpose: OtpPurpose) {
  const code = generateCode();
  await Otp.deleteMany({ email, purpose });
  await Otp.create({
    email,
    purpose,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
  });
  return { code, expiresInMinutes: OTP_TTL_MINUTES };
}

type VerifyResult = { ok: true } | { ok: false; error: string };

export async function verifyOtp(
  email: string,
  purpose: OtpPurpose,
  code: string
): Promise<VerifyResult> {
  const doc = await Otp.findOne({ email, purpose });
  if (!doc) return { ok: false, error: "This code has expired. Please request a new one." };
  if (doc.expiresAt.getTime() < Date.now()) {
    await doc.deleteOne();
    return { ok: false, error: "This code has expired. Please request a new one." };
  }
  if (doc.attempts >= MAX_ATTEMPTS) {
    await doc.deleteOne();
    return { ok: false, error: "Too many incorrect attempts. Please request a new code." };
  }
  if (doc.codeHash !== hashCode(code)) {
    doc.attempts += 1;
    await doc.save();
    return { ok: false, error: "That code is not correct." };
  }
  doc.verifiedAt = new Date();
  await doc.save();
  return { ok: true };
}

// The final step (set password) must follow a verified code.
export async function consumeVerifiedOtp(email: string, purpose: OtpPurpose) {
  const doc = await Otp.findOne({ email, purpose, verifiedAt: { $ne: null } });
  if (!doc) return false;
  if (doc.expiresAt.getTime() < Date.now()) {
    await doc.deleteOne();
    return false;
  }
  await doc.deleteOne();
  return true;
}
