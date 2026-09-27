"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

import { ApiError } from "@/api";
import { useCurrentUser } from "@/hooks/users/use-current-user";

const CREATE_PROFILE_PATH = "/complete-profile";
const APP_HOME_PATH = "/";
const DASHBOARD_PATH = "/dashboard";

export function ProfileRedirectGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const currentUserQuery = useCurrentUser();
  const currentUserError = currentUserQuery.error;
  const isCompleteProfilePage = pathname === "/complete-profile";
  const profileMissing =
    currentUserError instanceof ApiError && currentUserError.status === 404;
  const hasProfile = Boolean(currentUserQuery.data?.user);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!authenticated) {
      if (isCompleteProfilePage) {
        router.replace(APP_HOME_PATH);
      }

      return;
    }

    if (currentUserQuery.isLoading || currentUserQuery.isFetching) {
      return;
    }

    if (profileMissing && !isCompleteProfilePage) {
      router.replace(CREATE_PROFILE_PATH);
      return;
    }

    if (
      hasProfile &&
      (isCompleteProfilePage || pathname === APP_HOME_PATH)
    ) {
      router.replace(DASHBOARD_PATH);
    }
  }, [
    authenticated,
    currentUserQuery.isFetching,
    currentUserQuery.isLoading,
    hasProfile,
    isCompleteProfilePage,
    profileMissing,
    pathname,
    ready,
    router,
  ]);

  return null;
}
