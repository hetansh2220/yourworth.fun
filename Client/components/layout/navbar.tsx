"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLogout, usePrivy } from "@privy-io/react-auth";

import { ApiError } from "@/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/users/use-current-user";

export function Navbar() {
    const router = useRouter();
    const { ready, authenticated } = usePrivy();
    const { logout } = useLogout();
    const currentUserQuery = useCurrentUser();
    const currentUserError = currentUserQuery.error;
    const profileMissing =
        currentUserError instanceof ApiError && currentUserError.status === 404;
    const user = currentUserQuery.data?.user;

    return (
        <nav className="border-b border-[#24262B] bg-[#050505]">
            <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-5 sm:px-8">
                <Link href="/" className="flex items-center">
                    <Image
                        src="/brand/logo.png"
                        alt="Worth"
                        width={84}
                        height={84}
                        priority
                        className="size-14 rounded-lg"
                    />
                </Link>

                <div className="flex items-center gap-3">
                    {ready && authenticated && user && (
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-2.5 rounded-xl border border-[#24262B] bg-[#0D0D0F] px-3.5 py-2 transition-all hover:border-[#79AFFF]/40 hover:bg-[#151518]"
                        >
                            <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-[#79AFFF] to-[#4A8FE7] text-[10px] font-bold text-[#050505]">
                                {user.username?.charAt(0).toUpperCase() ?? "U"}
                            </div>
                            <span className="hidden text-xs font-medium text-[#F5F7FA] sm:block">
                                @{user.username}
                            </span>
                        </Link>
                    )}

                    {ready && authenticated && profileMissing ? (
                        <Link
                            href="/login?step=profile"
                            className={buttonVariants({
                                variant: "outline",
                                className:
                                    "border-[#2A2D33] bg-[#101014] px-5 py-1.5 text-base text-[#F5F7FA] hover:bg-[#17171C]",
                            })}
                        >
                            Complete profile
                        </Link>
                    ) : null}

                    <Button
                        className="px-8 py-1.5 text-base"
                        onClick={() => {
                            if (!ready) {
                                return;
                            }

                            if (authenticated) {
                                logout();
                                return;
                            }

                            router.push("/login");
                        }}
                    >
                        {ready && authenticated ? "Logout" : "Login"}
                    </Button>
                </div>
            </div>
        </nav>
    );
}
