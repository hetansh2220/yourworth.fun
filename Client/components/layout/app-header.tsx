"use client";

import Link from "next/link";
import { Bell, Menu, UserRound } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/users/use-current-user";
import { ApiError } from "@/api";

export function AppHeader({
    title,
    subtitle,
    onMenuClick,
}: {
    title: string;
    subtitle?: string;
    onMenuClick?: () => void;
}) {
    const { ready, authenticated } = usePrivy();
    const currentUserQuery = useCurrentUser();
    const profileMissing =
        currentUserQuery.error instanceof ApiError &&
        currentUserQuery.error.status === 404;

    return (
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#24262B] bg-[#050505]/95 px-5 backdrop-blur-xl lg:px-8">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onMenuClick}
                    className="flex size-9 items-center justify-center rounded-lg border border-[#24262B] bg-[#0D0D0F] text-[#8B9099] hover:text-[#F5F7FA] lg:hidden"
                >
                    <Menu className="size-4" />
                </button>

                <div>
                    <p className="text-sm font-semibold text-[#F5F7FA]">{title}</p>
                    {subtitle ? (
                        <p className="text-xs text-[#8B9099]">{subtitle}</p>
                    ) : null}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-xl border border-[#24262B] bg-[#0D0D0F] text-[#8B9099] hover:text-[#F5F7FA]"
                >
                    <Bell className="size-4" />
                </button>

                <Link
                    href={
                        ready && authenticated
                            ? profileMissing
                                ? "/login?step=profile"
                                : "/dashboard"
                            : "/login"
                    }
                    className="flex size-9 items-center justify-center rounded-xl border border-[#24262B] bg-[#0D0D0F] text-[#8B9099] hover:text-[#F5F7FA]"
                >
                    <UserRound className="size-4" />
                </Link>

                {ready && !authenticated ? (
                    <Link href="/login">
                        <Button
                            size="sm"
                            className="h-9 px-4 text-xs font-semibold"
                        >
                            Login
                        </Button>
                    </Link>
                ) : null}
            </div>
        </header>
    );
}
