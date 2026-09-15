"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import LoginCode from "@/components/auth/login-code";
import LoginEmail from "@/components/auth/login-email";
import LoginProfile from "@/components/auth/login-profile";

function LoginFlow() {
  const searchParams = useSearchParams();
  const step = searchParams.get("step") ?? "email";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-sm">
        {step === "code" ? (
          <LoginCode />
        ) : step === "profile" ? (
          <LoginProfile />
        ) : (
          <LoginEmail />
        )}
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFlow />
    </Suspense>
  );
}
