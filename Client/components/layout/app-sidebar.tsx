"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    BarChart3,
    Compass,
    Home,
    LogOut,
    Search,
    Settings,
    Trophy,
    Wallet,
    X,
} from "lucide-react";
import { useLogout, usePrivy } from "@privy-io/react-auth";

export function AppSidebar({
    className = "",
    onNavigate,
}: {
    className?: string;
    onNavigate?: () => void;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { ready, authenticated } = usePrivy();
    const { logout } = useLogout();

    const isDashboard = pathname === "/dashboard";
    const isExplore = pathname === "/explore" || pathname.startsWith("/creator");

    return (
        <aside
            className={`fixed inset-y-0 left-0 hidden w-[72px] border-r border-[#24262B] bg-[#0D0D0F] lg:flex lg:flex-col lg:items-center ${className}`}
        >
            <Link
                href="/"
                onClick={onNavigate}
                className="flex size-[72px] items-center justify-center border-b border-[#24262B]"
            >
                <Image
                    src="/brand/logo.png"
                    alt="Worth"
                    width={44}
                    height={44}
                    className="size-11 rounded-xl"
                />
            </Link>

            <div className="flex flex-1 flex-col items-center gap-3 py-6">
                <Link
                    href="/dashboard"
                    onClick={onNavigate}
                    className={`flex size-10 items-center justify-center rounded-xl transition-colors ${
                        isDashboard
                            ? "bg-[#151518] text-[#79AFFF]"
                            : "text-[#8B9099] hover:bg-[#151518] hover:text-[#F5F7FA]"
                    }`}
                >
                    <Home className="size-[18px]" />
                </Link>

                <Link
                    href="/explore"
                    onClick={onNavigate}
                    className={`flex size-10 items-center justify-center rounded-xl transition-colors ${
                        isExplore
                            ? "bg-[#151518] text-[#79AFFF]"
                            : "text-[#8B9099] hover:bg-[#151518] hover:text-[#F5F7FA]"
                    }`}
                >
                    <Compass className="size-[18px]" />
                </Link>

                <Link
                    href="/explore"
                    onClick={onNavigate}
                    className="flex size-10 items-center justify-center rounded-xl text-[#8B9099] transition-colors hover:bg-[#151518] hover:text-[#F5F7FA]"
                >
                    <Search className="size-[18px]" />
                </Link>

                <button
                    type="button"
                    className="flex size-10 items-center justify-center rounded-xl text-[#8B9099] transition-colors hover:bg-[#151518] hover:text-[#F5F7FA]"
                >
                    <BarChart3 className="size-[18px]" />
                </button>

                <button
                    type="button"
                    className="flex size-10 items-center justify-center rounded-xl text-[#8B9099] transition-colors hover:bg-[#151518] hover:text-[#F5F7FA]"
                >
                    <Wallet className="size-[18px]" />
                </button>

                <button
                    type="button"
                    className="flex size-10 items-center justify-center rounded-xl text-[#8B9099] transition-colors hover:bg-[#151518] hover:text-[#F5F7FA]"
                >
                    <Trophy className="size-[18px]" />
                </button>
            </div>

            <div className="flex flex-col items-center gap-3 border-t border-[#24262B] py-5">
                <button
                    type="button"
                    className="flex size-10 items-center justify-center rounded-xl text-[#8B9099] transition-colors hover:bg-[#151518] hover:text-[#F5F7FA]"
                >
                    <Settings className="size-[18px]" />
                </button>

                <button
                    type="button"
                    onClick={() => {
                        if (ready && authenticated) {
                            logout();
                        } else {
                            router.push("/login");
                        }
                    }}
                    className="flex size-10 items-center justify-center rounded-xl text-[#8B9099] transition-colors hover:bg-[#151518] hover:text-[#F5F7FA]"
                >
                    <LogOut className="size-[18px]" />
                </button>
            </div>
        </aside>
    );
}

export function MobileNavDrawer({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { ready, authenticated } = usePrivy();
    const { logout } = useLogout();

    if (!isOpen) return null;

    const isDashboard = pathname === "/dashboard";
    const isExplore = pathname === "/explore" || pathname.startsWith("/creator");

    return (
        <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative z-10 flex w-[260px] flex-col border-r border-[#24262B] bg-[#0D0D0F] p-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#24262B] pb-4">
                    <Link
                        href="/"
                        onClick={onClose}
                        className="flex items-center gap-2.5"
                    >
                        <Image
                            src="/brand/logo.png"
                            alt="Worth"
                            width={36}
                            height={36}
                            className="size-9 rounded-lg"
                        />
                        <span className="text-base font-semibold tracking-tight text-[#F5F7FA]">
                            WORTH
                        </span>
                    </Link>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex size-8 items-center justify-center rounded-lg border border-[#24262B] text-[#8B9099] hover:text-[#F5F7FA]"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="mt-6 flex flex-1 flex-col gap-1.5">
                    <Link
                        href="/dashboard"
                        onClick={onClose}
                        className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                            isDashboard
                                ? "bg-[#151518] text-[#79AFFF]"
                                : "text-[#8B9099] hover:bg-[#151518] hover:text-[#F5F7FA]"
                        }`}
                    >
                        <Home className="size-4" />
                        <span>Dashboard</span>
                    </Link>

                    <Link
                        href="/explore"
                        onClick={onClose}
                        className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                            isExplore
                                ? "bg-[#151518] text-[#79AFFF]"
                                : "text-[#8B9099] hover:bg-[#151518] hover:text-[#F5F7FA]"
                        }`}
                    >
                        <Compass className="size-4" />
                        <span>Explore</span>
                    </Link>

                    <Link
                        href="/explore"
                        onClick={onClose}
                        className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#8B9099] transition-colors hover:bg-[#151518] hover:text-[#F5F7FA]"
                    >
                        <Search className="size-4" />
                        <span>Search</span>
                    </Link>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#8B9099] transition-colors hover:bg-[#151518] hover:text-[#F5F7FA]"
                    >
                        <BarChart3 className="size-4" />
                        <span>Analytics</span>
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#8B9099] transition-colors hover:bg-[#151518] hover:text-[#F5F7FA]"
                    >
                        <Wallet className="size-4" />
                        <span>Holdings</span>
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#8B9099] transition-colors hover:bg-[#151518] hover:text-[#F5F7FA]"
                    >
                        <Trophy className="size-4" />
                        <span>Leaderboard</span>
                    </button>
                </div>

                <div className="border-t border-[#24262B] pt-4">
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            if (ready && authenticated) {
                                logout();
                            } else {
                                router.push("/login");
                            }
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#8B9099] transition-colors hover:bg-[#151518] hover:text-[#F5F7FA]"
                    >
                        <LogOut className="size-4" />
                        <span>
                            {ready && authenticated ? "Logout" : "Login"}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
