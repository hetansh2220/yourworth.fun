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
      className="mx-auto grid w-full max-w-md gap-7 text-center"
      onSubmit={(event) => {
        event.preventDefault();
        submitEmail();
      }}
    >
      <div className="grid gap-4">
        <h1 className="text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
          Welcome to worth
        </h1>
        <p className="text-base text-white/60 sm:text-lg">
          Enter your email to login
        </p>
      </div>

      <div className="grid gap-4">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
          }}
          aria-invalid={Boolean(error)}
        />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Log in"}
        </Button>
      </div>
    </form>
  );
}
