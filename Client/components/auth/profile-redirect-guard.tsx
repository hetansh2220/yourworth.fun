"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

import { ApiError } from "@/api";
import { useCurrentUser } from "@/hooks/users/use-current-user";

const CREATE_PROFILE_PATH = "/login?step=profile";
const APP_HOME_PATH = "/";

export function ProfileRedirectGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, authenticated } = usePrivy();
  const currentUserQuery = useCurrentUser();
  const currentUserError = currentUserQuery.error;
  const step = searchParams.get("step");
  const isLoginPage = pathname === "/login";
  const isCreateProfilePage = isLoginPage && step === "profile";
  const profileMissing =
    currentUserError instanceof ApiError && currentUserError.status === 404;
  const hasProfile = Boolean(currentUserQuery.data?.user);

  useEffect(() => {
    if (!ready || !authenticated) {
      return;
    }

    if (currentUserQuery.isLoading || currentUserQuery.isFetching) {
      return;
    }

    if (profileMissing && !isCreateProfilePage) {
      router.replace(CREATE_PROFILE_PATH);
      return;
    }

    if (hasProfile && isLoginPage) {
      router.replace(APP_HOME_PATH);
    }
  }, [
    authenticated,
    currentUserQuery.isFetching,
    currentUserQuery.isLoading,
    hasProfile,
    isCreateProfilePage,
    isLoginPage,
    profileMissing,
    ready,
    router,
  ]);

  return null;
}
