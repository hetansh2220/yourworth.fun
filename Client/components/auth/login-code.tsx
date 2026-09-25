"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLoginWithEmail } from "@privy-io/react-auth";
import LoginProfile from "@/components/auth/login-profile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function getStoredEmail() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.sessionStorage.getItem("newtime:email") ?? "";
}

function LoginCodeSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-md gap-7">
      <div className="grid gap-4">
        <Skeleton className="h-12 w-56 bg-white/10" />
        <div className="grid gap-2">
          <Skeleton className="h-5 w-full bg-white/10" />
          <Skeleton className="h-5 w-2/3 bg-white/10" />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2 sm:gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton
            key={index}
            className="aspect-square h-auto w-full rounded-xl bg-white/10 sm:rounded-2xl"
          />
        ))}
      </div>

      <div className="grid gap-4">
        <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
        <Skeleton className="mx-auto h-5 w-24 bg-white/10" />
      </div>
    </div>
  );
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");

  if (!name || !domain) {
    return "your email address";
  }

  return `${name.charAt(0)}****@${domain}`;
}

export default function LoginCode() {
  const router = useRouter();
  const { loginWithCode, sendCode } = useLoginWithEmail();
  const [email] = useState(getStoredEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [finishingLogin, setFinishingLogin] = useState(false);

  useEffect(() => {
    router.prefetch("/login?step=profile");
  }, [router]);

  useEffect(() => {
    if (!email) {
      router.replace("/login");
    }
  }, [email, router]);

  async function submitCode() {
    if (code.length !== 6) {
      setError("Enter the 6 digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await loginWithCode({ code });
      window.sessionStorage.removeItem("newtime:email");
      setFinishingLogin(true);
      router.replace("/login?step=profile", { scroll: false });
    } catch (loginError) {
      setError(getErrorMessage(loginError));
      setLoading(false);
      setFinishingLogin(false);
    }
  }

  async function resendCode() {
    if (!email) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await sendCode({ email });
      setCode("");
    } catch (sendError) {
      setError(getErrorMessage(sendError));
    } finally {
      setLoading(false);
    }
  }

  if (!email || finishingLogin) {
    return finishingLogin ? <LoginProfile /> : <LoginCodeSkeleton />;
  }

  return (
    <form
      className="mx-auto grid w-full max-w-md gap-7 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        submitCode();
      }}
    >
      <div className="grid gap-4">
        <h1 className="text-3xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
          Verify email
        </h1>
        <p className="text-base leading-snug text-white/70 sm:text-lg">
          Enter the 6 digit code sent to your email address
          <br />
          <span className="font-semibold text-white/85">
            {maskEmail(email)}
          </span>{" "}
          below.
        </p>
      </div>

      <InputOTP
        maxLength={6}
        value={code}
        onChange={setCode}
        containerClassName="w-full"
      >
        <InputOTPGroup className="grid w-full grid-cols-6 gap-2 sm:gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <InputOTPSlot
              key={index}
              index={index}
              className="aspect-square h-auto w-full min-w-0 rounded-xl border border-white/5 bg-white/10 text-xl font-medium text-white shadow-none transition-colors data-[active=true]:border-primary-400 data-[active=true]:ring-2 data-[active=true]:ring-primary-400/60 sm:rounded-2xl sm:text-2xl"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>

      <div className="grid gap-4">
        {loading ? <Skeleton className="h-5 w-40 bg-white/10" /> : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" disabled={loading || code.length !== 6}>
          Verify
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={resendCode}
          disabled={loading}
          className="text-white/70 hover:bg-white/10 hover:text-white"
        >
          Resend OTP
        </Button>
      </div>
    </form>
  );
}
