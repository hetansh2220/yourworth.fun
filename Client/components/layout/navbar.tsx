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

    return (
        <nav className="border-b border-[#24262B] bg-[#050505]">
            <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-5 sm:px-8">
                <Link href="/explore" className="flex items-center">
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
                    {ready && authenticated && currentUserQuery.data?.user ? (
                        <p className="hidden text-sm text-white/55 sm:block">
                            {currentUserQuery.data.user.username}
                        </p>
                    ) : null}

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
