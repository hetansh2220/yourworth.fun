"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLoginWithEmail } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function LoginEmail() {
  const router = useRouter();
  const { sendCode } = useLoginWithEmail();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitEmail() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Enter your email.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await sendCode({ email: normalizedEmail });
      window.sessionStorage.setItem("newtime:email", normalizedEmail);
      router.push("/login?step=code");
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
        submitEmail();
      }}
    >
      <div>
        <p className="text-sm text-muted-foreground">Step 1 of 3</p>
        <h1 className="mt-1 text-2xl font-semibold">Enter your email</h1>
      </div>

      <Input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setError("");
        }}
        aria-invalid={Boolean(error)}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Sending..." : "Send OTP"}
      </Button>
    </form>
  );
}
