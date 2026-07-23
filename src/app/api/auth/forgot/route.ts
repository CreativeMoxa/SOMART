import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Employee, normalizeEmail } from "@/models/Employee";
import { issueOtp, verifyOtp, consumeVerifiedOtp } from "@/models/Otp";
import { hashPassword, passwordProblem } from "@/lib/password";
import { sendOtpEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { requestContext } from "@/lib/auth";
import { logActivity } from "@/models/ActivityLog";
import type { Role } from "@/lib/roles";

// Password reset: start (send code) → verify (check code) → reset (new password).
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const step = String(body.step ?? "start");
    const email = normalizeEmail(body.email);
    const { ip } = await requestContext();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const employee = await Employee.findOne({ email });

    if (step === "start") {
      const limited = rateLimit(`fp:${email}:${ip}`, 5, 15 * 60 * 1000);
      if (!limited.ok) {
        return NextResponse.json(
          { error: `Too many attempts. Try again in ${limited.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }
      // Always report success so the endpoint can't reveal who has an account.
      if (!employee || employee.status !== "active" || !employee.passwordHash) {
        return NextResponse.json({ ok: true, emailed: true });
      }
      const { code, expiresInMinutes } = await issueOtp(email, "reset");
      const result = await sendOtpEmail(email, employee.name, code, "reset", expiresInMinutes);
      return NextResponse.json({ ok: true, emailed: result.sent, devCode: result.devCode });
    }

    if (step === "verify") {
      const limited = rateLimit(`fpv:${email}:${ip}`, 10, 15 * 60 * 1000);
      if (!limited.ok) {
        return NextResponse.json(
          { error: `Too many attempts. Try again in ${limited.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }
      const result = await verifyOtp(email, "reset", String(body.code ?? ""));
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (step === "reset") {
      const password = String(body.password ?? "");
      const problem = passwordProblem(password);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });

      const verified = await consumeVerifiedOtp(email, "reset");
      if (!verified || !employee) {
        return NextResponse.json({ error: "Please verify your code again." }, { status: 400 });
      }

      employee.passwordHash = await hashPassword(password);
      // Changing the password signs every existing device out.
      employee.sessionVersion += 1;
      employee.currentSessionId = "";
      await employee.save();

      await logActivity({
        employeeId: employee._id,
        employeeName: employee.name,
        employeeRole: employee.role as Role,
        action: "reset their password",
        module: "employees",
        reference: email,
        ip,
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown step" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/auth/forgot failed:", err);
    return NextResponse.json({ error: "Password reset failed" }, { status: 500 });
  }
}
