import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Employee, ensureFounderCeo, normalizeEmail } from "@/models/Employee";
import { issueOtp, verifyOtp, consumeVerifiedOtp } from "@/models/Otp";
import { hashPassword, passwordProblem } from "@/lib/password";
import { sendOtpEmail, sendWelcomeEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { requestContext } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { logActivity } from "@/models/ActivityLog";

// Registration only works for an email the CEO has already added as an
// employee. Steps: start (send code) → verify (check code) → complete (set
// password, activate, welcome email).
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    await ensureFounderCeo();

    const body = await req.json();
    const step = String(body.step ?? "start");
    const email = normalizeEmail(body.email);
    const { ip } = await requestContext();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const employee = await Employee.findOne({ email });
    // Same message whether or not the address exists is not desirable here —
    // the spec asks for an explicit "not an employee" message.
    if (!employee) {
      return NextResponse.json(
        {
          error:
            "This email is not registered as an employee. Please contact your administrator.",
        },
        { status: 404 }
      );
    }
    if (employee.status !== "active") {
      return NextResponse.json(
        { error: "This account is not active. Please contact your administrator." },
        { status: 403 }
      );
    }

    // ── Step 1: send the code ────────────────────────────────────────────
    if (step === "start") {
      const limited = rateLimit(`reg:${email}:${ip}`, 5, 15 * 60 * 1000);
      if (!limited.ok) {
        return NextResponse.json(
          { error: `Too many attempts. Try again in ${limited.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }
      if (employee.passwordHash) {
        return NextResponse.json(
          { error: "This account is already registered. Please sign in instead." },
          { status: 400 }
        );
      }
      const { code, expiresInMinutes } = await issueOtp(email, "register");
      const result = await sendOtpEmail(
        email,
        employee.name,
        code,
        "register",
        expiresInMinutes
      );
      return NextResponse.json({
        ok: true,
        emailed: result.sent,
        // Only present when SMTP isn't configured yet, so the flow stays usable.
        devCode: result.devCode,
      });
    }

    // ── Step 2: verify the code ──────────────────────────────────────────
    if (step === "verify") {
      const limited = rateLimit(`regv:${email}:${ip}`, 10, 15 * 60 * 1000);
      if (!limited.ok) {
        return NextResponse.json(
          { error: `Too many attempts. Try again in ${limited.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }
      const result = await verifyOtp(email, "register", String(body.code ?? ""));
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    // ── Step 3: set the password and activate ────────────────────────────
    if (step === "complete") {
      const password = String(body.password ?? "");
      const problem = passwordProblem(password);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });

      const verified = await consumeVerifiedOtp(email, "register");
      if (!verified) {
        return NextResponse.json(
          { error: "Please verify your email code again." },
          { status: 400 }
        );
      }

      employee.passwordHash = await hashPassword(password);
      employee.registeredAt = new Date();
      employee.sessionVersion += 1; // invalidate anything issued earlier
      await employee.save();

      const loginUrl = new URL("/admin/login", req.nextUrl.origin).toString();
      await sendWelcomeEmail(
        email,
        employee.name,
        ROLE_LABELS[employee.role as Role],
        loginUrl
      );

      await logActivity({
        employeeId: employee._id,
        employeeName: employee.name,
        employeeRole: employee.role as Role,
        action: "completed registration",
        module: "employees",
        reference: email,
        ip,
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown step" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/auth/register failed:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
