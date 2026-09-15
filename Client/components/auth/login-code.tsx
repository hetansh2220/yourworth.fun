"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLoginWithEmail } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
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

export default function LoginCode() {
  const router = useRouter();
  const { loginWithCode, sendCode } = useLoginWithEmail();
  const [email] = useState(getStoredEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitCode() {
    if (code.length !== 6) {
      setError("Enter the 6 digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await loginWithCode({ code });
      router.push("/login?step=profile");
    } catch (loginError) {
      setError(getErrorMessage(loginError));
    } finally {
      setLoading(false);
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

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submitCode();
      }}
    >
      <div>
        <p className="text-sm text-muted-foreground">Step 2 of 3</p>
        <h1 className="mt-1 text-2xl font-semibold">Enter the OTP</h1>
      </div>

      <InputOTP maxLength={6} value={code} onChange={setCode}>
        <InputOTPGroup className="gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <InputOTPSlot
              key={index}
              index={index}
              className="size-10 rounded-lg border bg-background"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>

      <p className="text-sm text-muted-foreground">
        Sent to {email || "your email"}
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={loading || code.length !== 6}>
        {loading ? "Checking..." : "Verify"}
      </Button>

      <Button type="button" variant="ghost" onClick={resendCode} disabled={loading}>
        Resend OTP
      </Button>
    </form>
  );
}
