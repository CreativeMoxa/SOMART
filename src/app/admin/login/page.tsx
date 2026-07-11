import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Admin Login",
};

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 sm:px-6">
      <Image
        src="/logo-mark.jpeg"
        alt=""
        width={56}
        height={56}
        aria-hidden
        className="logo-adaptive animate-float rounded-full"
      />
      <h1 className="animate-fade-up mt-5 text-3xl font-semibold">Admin Login</h1>
      <p className="animate-fade-up delay-100 mt-1 text-sm text-muted">
        Sign in to manage the SOMART store.
      </p>
      <div className="animate-fade-up delay-200 mt-8 w-full rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <LoginForm />
      </div>
    </div>
  );
}
