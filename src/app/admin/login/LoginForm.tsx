"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background px-4 py-2.5 transition-colors duration-200 focus:border-gold focus:outline-2 focus:outline-offset-1 focus:outline-gold/40";

type Tab = "login" | "register" | "forgot";
// Multi-step flows share the same shape: ask email → code → password.
type Stage = "email" | "code" | "password";

const TABS: { key: Tab; label: string }[] = [
  { key: "login", label: "Login" },
  { key: "register", label: "Register" },
  { key: "forgot", label: "Forgot Password" },
];

export default function LoginForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [stage, setStage] = useState<Stage>("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  // Single-device takeover: a correct password on an already-signed-in
  // account isn't enough — the owner confirms with an emailed code.
  const [deviceOtp, setDeviceOtp] = useState(false);
  const [deviceCode, setDeviceCode] = useState("");

  function switchTab(next: Tab) {
    setTab(next);
    setStage("email");
    setError(null);
    setNotice(null);
    setCode("");
    setPassword("");
    setConfirm("");
    setDeviceOtp(false);
    setDeviceCode("");
  }

  async function post(url: string, payload: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Something went wrong");
    return body as Record<string, unknown>;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      // ── Sign in ──────────────────────────────────────────────────────
      if (tab === "login") {
        // Employees sign in with email; the owner's break-glass account still
        // works with its username.
        const isEmail = email.includes("@");
        if (!isEmail) {
          await post("/api/admin/login", { username: email, password, remember });
          router.push("/admin");
          router.refresh();
          return;
        }
        const body = await post("/api/auth/login", {
          email,
          password,
          remember,
          ...(deviceOtp ? { code: deviceCode } : {}),
        });
        // Single-device account already signed in elsewhere → confirm by code.
        if (body.requiresDeviceOtp) {
          setDeviceOtp(true);
          setNotice(
            body.devCode
              ? `Email isn't connected yet — your code is ${body.devCode}`
              : (body.message as string) ??
                  "This account is already signed in on another device. Enter the code we emailed you."
          );
          return;
        }
        router.push("/admin");
        router.refresh();
        return;
      }

      const endpoint = tab === "register" ? "/api/auth/register" : "/api/auth/forgot";

      // ── Step 1: request a code ───────────────────────────────────────
      if (stage === "email") {
        const body = await post(endpoint, { step: "start", email });
        setStage("code");
        setNotice(
          body.devCode
            ? `Email isn't connected yet — your code is ${body.devCode}`
            : `We sent a 6-digit code to ${email}. It expires in 10 minutes.`
        );
        return;
      }

      // ── Step 2: verify the code ──────────────────────────────────────
      if (stage === "code") {
        await post(endpoint, { step: "verify", email, code });
        setStage("password");
        setNotice("Code verified. Now choose your password.");
        return;
      }

      // ── Step 3: set the password ─────────────────────────────────────
      if (password !== confirm) throw new Error("The two passwords don't match.");
      await post(endpoint, {
        step: tab === "register" ? "complete" : "reset",
        email,
        password,
      });
      switchTab("login");
      setNotice(
        tab === "register"
          ? "Your account is ready — please sign in."
          : "Password updated — please sign in."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = busy
    ? "Please wait…"
    : tab === "login"
      ? deviceOtp
        ? "Confirm & Sign In"
        : "Sign In"
      : stage === "email"
        ? "Send Code"
        : stage === "code"
          ? "Verify Code"
          : tab === "register"
            ? "Create Account"
            : "Reset Password";

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-full border border-line bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            className={`flex-1 cursor-pointer rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition-colors duration-200 ${
              tab === t.key ? "bg-gold-bright" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email is always the starting point (or username for the owner). */}
        {(tab === "login" || stage === "email") && (
          <div>
            <label htmlFor="email" className="text-sm font-semibold">
              {tab === "login" ? "Email" : "Employee email"}
            </label>
            <input
              id="email"
              name="email"
              type={tab === "login" ? "text" : "email"}
              required
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // Changing the email cancels a pending device confirmation.
                if (deviceOtp) {
                  setDeviceOtp(false);
                  setDeviceCode("");
                }
              }}
              placeholder="you@example.com"
              className={inputClass}
            />
            {tab === "register" && (
              <p className="mt-1 text-xs text-muted">
                Use the email address your administrator added for you.
              </p>
            )}
          </div>
        )}

        {tab === "login" && (
          <div>
            <label htmlFor="password" className="text-sm font-semibold">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        {tab === "login" && deviceOtp && (
          <div>
            <label htmlFor="device-code" className="text-sm font-semibold">
              New device code
            </label>
            <input
              id="device-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={deviceCode}
              onChange={(e) => setDeviceCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className={`${inputClass} text-center text-2xl font-bold tracking-[0.5em]`}
            />
            <p className="mt-1 text-xs text-muted">
              Signing in here will sign the other device out.
            </p>
          </div>
        )}

        {tab !== "login" && stage === "code" && (
          <div>
            <label htmlFor="code" className="text-sm font-semibold">6-digit code</label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className={`${inputClass} text-center text-2xl font-bold tracking-[0.5em]`}
            />
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const body = await post(
                    tab === "register" ? "/api/auth/register" : "/api/auth/forgot",
                    { step: "start", email }
                  );
                  setNotice(
                    body.devCode
                      ? `Email isn't connected yet — your code is ${body.devCode}`
                      : "A new code is on its way."
                  );
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not resend");
                } finally {
                  setBusy(false);
                }
              }}
              className="mt-2 cursor-pointer text-xs font-semibold text-gold hover:underline"
            >
              Resend code
            </button>
          </div>
        )}

        {tab !== "login" && stage === "password" && (
          <>
            <div>
              <label htmlFor="new-password" className="text-sm font-semibold">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted">
                At least 8 characters, including a letter and a number.
              </p>
            </div>
            <div>
              <label htmlFor="confirm-password" className="text-sm font-semibold">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </div>
          </>
        )}

        {tab === "login" && (
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-current"
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => switchTab("forgot")}
              className="cursor-pointer text-sm font-semibold text-gold hover:underline"
            >
              Forgot password?
            </button>
          </div>
        )}

        {notice && (
          <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-500">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full cursor-pointer rounded-full bg-gold-bright px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitLabel}
        </button>

        {tab !== "login" && stage !== "email" && (
          <button
            type="button"
            onClick={() => switchTab(tab)}
            className="w-full cursor-pointer text-xs font-semibold text-muted hover:text-foreground"
          >
            Start over
          </button>
        )}
      </form>
    </div>
  );
}
