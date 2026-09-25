"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoginCode from "@/components/auth/login-code";
import LoginEmail from "@/components/auth/login-email";
import LoginProfile from "@/components/auth/login-profile";
import { Skeleton } from "@/components/ui/skeleton";

function LoginPageSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-5 py-10 text-white">
      <section className="grid w-full max-w-md gap-7">
        <div className="grid justify-items-center gap-4">
          <Skeleton className="h-12 w-64 bg-white/10" />
          <Skeleton className="h-5 w-52 bg-white/10" />
        </div>
        <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
        <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
      </section>
    </main>
  );
}

function LoginFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStep = searchParams.get("step") ?? "email";
  const [stepOverride, setStepOverride] = useState<string | null>(null);
  const step = stepOverride ?? urlStep;

  function completeCodeLogin() {
    setStepOverride("profile");
    router.replace("/login?step=profile", { scroll: false });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-5 py-10 text-white">
      <section className="w-full max-w-2xl">
        {step === "code" ? (
          <LoginCode onVerified={completeCodeLogin} />
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
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginFlow />
    </Suspense>
  );
}
