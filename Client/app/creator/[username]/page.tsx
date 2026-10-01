"use client";

import { use, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import {
    BadgeCheck,
    Bookmark,
    Clock,
    Lock,
    MessageSquare,
    Share2,
    ShieldCheck,
    Star,
    TrendingDown,
    TrendingUp,
    Users,
    UserX,
    Wallet,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/layout/navbar";
import { getCreatorByUsername } from "@/data/creators";
import { WorthChart } from "@/components/charts/worth-chart";
import { getMockHistoricalData, type ChartTimeframe } from "@/data/chart-data";

type TabType = "about" | "market" | "activity" | "reviews";

export default function CreatorProfilePage({
    params,
}: {
    params: Promise<{ username: string }>;
}) {
    const resolvedParams = use(params);
    const { ready, authenticated, login } = usePrivy();

    const creator = getCreatorByUsername(resolvedParams.username);

    const [activeTab, setActiveTab] = useState<TabType>("about");
    const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
    const [selectedMinutes, setSelectedMinutes] = useState<number>(15);
    const [customMinutes, setCustomMinutes] = useState<string>("");
    const [isCustom, setIsCustom] = useState<boolean>(false);
    const [isWatchlisted, setIsWatchlisted] = useState<boolean>(false);
    const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
    const [creatorTimeframe, setCreatorTimeframe] = useState<ChartTimeframe>("1D");

    if (!creator) {
        const cleanUser = decodeURIComponent(resolvedParams.username).replace(
            /^@/,
            ""
        );
        return (
            <main className="min-h-screen bg-[#050505] text-[#F5F7FA]">
                <Navbar />
                <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-[1400px] flex-col items-center justify-center px-5 text-center">
                    <div className="flex size-16 items-center justify-center rounded-2xl border border-[#24262B] bg-[#0D0D0F] text-[#8B9099]">
                        <UserX className="size-8" />
                    </div>
                    <h1 className="mt-5 text-2xl font-semibold text-[#F5F7FA]">
                        Creator not found
                    </h1>
                    <p className="mt-2 max-w-sm text-sm text-[#8B9099]">
                        We couldn&apos;t find a creator with the username @
                        {cleanUser}.
                    </p>
                    <Link href="/" className="mt-6">
                        <Button className="px-6">Back to Creators</Button>
                    </Link>
                </div>
            </main>
        );
    }

    const cleanUsername = creator.username.replace(/^@/, "");
    const isPositive = creator.change >= 0;
    const numericPrice =
        parseFloat(creator.price.replace(/[^0-9.]/g, "")) || 0;
    const activeMinutes = isCustom
        ? parseInt(customMinutes, 10) || 0
        : selectedMinutes;
    const totalCost = (numericPrice * activeMinutes).toFixed(2);

    const creatorChartData = getMockHistoricalData(
        `creator_${creator.username}`,
        creatorTimeframe,
        numericPrice,
        creator.change
    );

    const handleRequireAuth = (actionCallback?: () => void) => {
        if (!ready) return;
        if (!authenticated) {
            login();
            return;
        }
        actionCallback?.();
    };

    const handleTradeSubmit = () => {
        handleRequireAuth(() => {
            setNoticeMessage(
                tradeMode === "buy"
                    ? `Ready to purchase ${activeMinutes} minutes with ${creator.name}. Wallet and contract execution will connect here.`
                    : `Sell orders for ${creator.name} will be processed through the upcoming liquidity pool.`
            );
        });
    };

    const handleToggleWatchlist = () => {
        handleRequireAuth(() => {
            setIsWatchlisted((prev) => !prev);
        });
    };

    const handleAccessClick = (type: "dm" | "group") => {
        handleRequireAuth(() => {
            setNoticeMessage(
                type === "dm"
                    ? `Direct message with ${creator.name} requires active purchased minutes. Purchase minutes from the panel to unlock chat.`
                    : `Group chat access with ${creator.name} requires holding at least 15 active minutes.`
            );
        });
    };

    return (
        <main className="min-h-screen bg-[#050505] text-[#F5F7FA]">
            <Navbar />

            {noticeMessage ? (
                <div className="sticky top-[72px] z-40 border-b border-[#24262B] bg-[#0D0D0F]/95 px-5 py-3 backdrop-blur-md">
                    <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm text-[#79AFFF]">
                            <ShieldCheck className="size-4 shrink-0 text-[#79AFFF]" />
                            <span>{noticeMessage}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setNoticeMessage(null)}
                            className="text-[#8B9099] hover:text-[#F5F7FA]"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                </div>
            ) : null}

            <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
                <section className="rounded-3xl border border-[#24262B] bg-[#0D0D0F] p-6 sm:p-8">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                            <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border-2 border-[#24262B] sm:size-28 lg:size-32">
                                <img
                                    src={creator.image}
                                    alt={creator.name}
                                    className="size-full object-cover"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-2xl font-semibold tracking-tight text-[#F5F7FA] sm:text-3xl lg:text-4xl">
                                        {creator.name}
                                    </h1>
                                    <BadgeCheck className="size-6 text-[#79AFFF]" />
                                    {creator.category ? (
                                        <span className="rounded-full border border-[#24262B] bg-[#151518] px-3 py-0.5 text-xs font-medium text-[#8B9099]">
                                            {creator.category}
                                        </span>
                                    ) : null}
                                </div>

                                <p className="text-sm font-medium text-[#8B9099]">
                                    @{cleanUsername}
                                </p>

                                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                                    <div className="flex items-center gap-1 text-[#F5F7FA]">
                                        <Star className="size-4 fill-amber-400 text-amber-400" />
                                        <span className="font-semibold">
                                            {creator.rating.toFixed(2)}
                                        </span>
                                        <span className="text-[#8B9099]">
                                            ({creator.reviewsCount ?? 0}{" "}
                                            reviews)
                                        </span>
                                    </div>

                                    {creator.responseRate ? (
                                        <div className="flex items-center gap-1 text-[#8B9099]">
                                            <Clock className="size-3.5 text-[#79AFFF]" />
                                            <span>
                                                {creator.responseRate} response
                                                rate
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 self-start sm:self-center">
                            <Button
                                variant="outline"
                                onClick={handleToggleWatchlist}
                                className={`border-[#24262B] bg-[#151518] text-sm text-[#F5F7FA] hover:border-[#79AFFF]/40 hover:bg-[#1a1a20] ${
                                    isWatchlisted
                                        ? "border-[#79AFFF]/60 text-[#79AFFF]"
                                        : ""
                                }`}
                            >
                                <Bookmark
                                    className={`mr-2 size-4 ${
                                        isWatchlisted
                                            ? "fill-[#79AFFF] text-[#79AFFF]"
                                            : ""
                                    }`}
                                />
                                {isWatchlisted ? "Watchlisted" : "Watchlist"}
                            </Button>

                            <button
                                type="button"
                                onClick={() => {
                                    if (navigator.share) {
                                        navigator
                                            .share({
                                                title: creator.name,
                                                url: window.location.href,
                                            })
                                            .catch(() => {});
                                    } else {
                                        navigator.clipboard.writeText(
                                            window.location.href
                                        );
                                        setNoticeMessage(
                                            "Profile link copied to clipboard!"
                                        );
                                    }
                                }}
                                className="flex size-10 items-center justify-center rounded-xl border border-[#24262B] bg-[#151518] text-[#8B9099] transition-colors hover:border-[#79AFFF]/40 hover:text-[#F5F7FA]"
                            >
                                <Share2 className="size-4" />
                            </button>
                        </div>
                    </div>
                </section>

                <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="min-w-0 space-y-8">
                        <div className="border-b border-[#24262B]">
                            <div className="flex items-center gap-8 overflow-x-auto pb-px">
                                {(
                                    [
                                        { id: "about", label: "About Me" },
                                        { id: "market", label: "Market" },
                                        { id: "activity", label: "Activity" },
                                        { id: "reviews", label: "Reviews" },
                                    ] as const
                                ).map((tab) => {
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`relative pb-3 text-sm font-medium transition-colors whitespace-nowrap ${
                                                isActive
                                                    ? "text-[#79AFFF]"
                                                    : "text-[#8B9099] hover:text-[#F5F7FA]"
                                            }`}
                                        >
                                            {tab.label}
                                            {isActive ? (
                                                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#79AFFF]" />
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {activeTab === "about" ? (
                            <div className="space-y-8">
                                <section className="rounded-3xl border border-[#24262B] bg-[#0D0D0F] p-6 sm:p-7">
                                    <h2 className="text-base font-semibold text-[#F5F7FA]">
                                        About {creator.name}
                                    </h2>
                                    <p className="mt-3 text-sm leading-relaxed text-[#8B9099]">
                                        {creator.description}
                                    </p>

                                    <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#24262B] pt-6 sm:grid-cols-3">
                                        <div className="rounded-2xl border border-[#24262B] bg-[#151518] p-4">
                                            <p className="text-xs text-[#8B9099]">
                                                Rate / Minute
                                            </p>
                                            <p className="mt-1 text-base font-semibold text-[#F5F7FA]">
                                                {creator.price}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-[#24262B] bg-[#151518] p-4">
                                            <p className="text-xs text-[#8B9099]">
                                                Avg. Rating
                                            </p>
                                            <p className="mt-1 text-base font-semibold text-[#F5F7FA]">
                                                ★ {creator.rating.toFixed(2)}
                                            </p>
                                        </div>

                                        <div className="col-span-2 rounded-2xl border border-[#24262B] bg-[#151518] p-4 sm:col-span-1">
                                            <p className="text-xs text-[#8B9099]">
                                                Response Time
                                            </p>
                                            <p className="mt-1 text-base font-semibold text-[#F5F7FA]">
                                                &lt; 2 hours
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-3xl border border-[#24262B] bg-[#0D0D0F] p-6 sm:p-7">
                                    <div>
                                        <h2 className="text-base font-semibold text-[#F5F7FA]">
                                            Get access to {creator.name}
                                        </h2>
                                        <p className="mt-1 text-xs text-[#8B9099]">
                                            Use your purchased minutes to connect
                                            with {creator.name}
                                        </p>
                                    </div>

                                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                        <div className="flex flex-col justify-between rounded-2xl border border-[#24262B] bg-[#151518] p-5 transition-colors hover:border-[#79AFFF]/40">
                                            <div>
                                                <div className="flex size-11 items-center justify-center rounded-xl border border-[#24262B] bg-[#0D0D0F] text-[#79AFFF]">
                                                    <MessageSquare className="size-5" />
                                                </div>
                                                <h3 className="mt-4 text-sm font-semibold text-[#F5F7FA]">
                                                    Direct Message
                                                </h3>
                                                <p className="mt-1.5 text-xs leading-5 text-[#8B9099]">
                                                    1-on-1 private messaging.
                                                    Ask questions, get advice,
                                                    or discuss collaborations
                                                    directly.
                                                </p>
                                            </div>

                                            <div className="mt-5 border-t border-[#24262B] pt-4">
                                                <Button
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleAccessClick("dm")
                                                    }
                                                    className="w-full border-[#24262B] bg-[#0D0D0F] text-xs font-semibold text-[#F5F7FA] hover:border-[#79AFFF]/40 hover:bg-[#1a1a20]"
                                                >
                                                    {!ready || !authenticated ? (
                                                        <span className="flex items-center gap-1.5">
                                                            <Lock className="size-3.5 text-[#8B9099]" />
                                                            Login to Message
                                                        </span>
                                                    ) : (
                                                        "Start Message"
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex flex-col justify-between rounded-2xl border border-[#24262B] bg-[#151518] p-5 transition-colors hover:border-[#79AFFF]/40">
                                            <div>
                                                <div className="flex size-11 items-center justify-center rounded-xl border border-[#24262B] bg-[#0D0D0F] text-[#79AFFF]">
                                                    <Users className="size-5" />
                                                </div>
                                                <h3 className="mt-4 text-sm font-semibold text-[#F5F7FA]">
                                                    Group Chat
                                                </h3>
                                                <p className="mt-1.5 text-xs leading-5 text-[#8B9099]">
                                                    Access {creator.name}&apos;s
                                                    private holder circle, live
                                                    discussions, and community
                                                    updates.
                                                </p>
                                            </div>

                                            <div className="mt-5 border-t border-[#24262B] pt-4">
                                                <Button
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleAccessClick(
                                                            "group"
                                                        )
                                                    }
                                                    className="w-full border-[#24262B] bg-[#0D0D0F] text-xs font-semibold text-[#F5F7FA] hover:border-[#79AFFF]/40 hover:bg-[#1a1a20]"
                                                >
                                                    {!ready || !authenticated ? (
                                                        <span className="flex items-center gap-1.5">
                                                            <Lock className="size-3.5 text-[#8B9099]" />
                                                            Login to Join
                                                        </span>
                                                    ) : (
                                                        "Join Group Chat"
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        ) : null}

                        {activeTab === "market" ? (
                            <section className="space-y-6">
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                    <div className="rounded-2xl border border-[#24262B] bg-[#0D0D0F] p-5">
                                        <p className="text-xs text-[#8B9099]">
                                            Price / Minute
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-[#F5F7FA]">
                                            {creator.price}
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-[#24262B] bg-[#0D0D0F] p-5">
                                        <p className="text-xs text-[#8B9099]">
                                            24h Change
                                        </p>
                                        <p
                                            className={`mt-1 text-lg font-semibold ${
                                                isPositive
                                                    ? "text-[#22C55E]"
                                                    : "text-[#EF4444]"
                                            }`}
                                        >
                                            {isPositive ? "+" : ""}
                                            {creator.change.toFixed(2)}%
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-[#24262B] bg-[#0D0D0F] p-5">
                                        <p className="text-xs text-[#8B9099]">
                                            24h Volume
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-[#F5F7FA]">
                                            $4,820
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-[#24262B] bg-[#0D0D0F] p-5">
                                        <p className="text-xs text-[#8B9099]">
                                            Minutes Circulating
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-[#F5F7FA]">
                                            1,240 min
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-3xl border border-[#24262B] bg-[#0D0D0F] p-6 sm:p-7">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-[#F5F7FA]">
                                                Price History
                                            </h3>
                                            <p className="mt-0.5 text-xs text-[#8B9099]">
                                                Minute valuation trend over time
                                            </p>
                                        </div>

                                        <div className="flex items-center rounded-xl border border-[#24262B] bg-[#151518] p-1">
                                            {["1D", "1W", "1M", "1Y"].map(
                                                (period) => (
                                                    <button
                                                        key={period}
                                                        type="button"
                                                        className={`rounded-lg px-3 py-1.5 text-[11px] font-medium ${
                                                            period === "1D"
                                                                ? "bg-[#24262B] text-[#F5F7FA]"
                                                                : "text-[#8B9099] hover:text-[#F5F7FA]"
                                                        }`}
                                                    >
                                                        {period}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-8 h-[240px] rounded-2xl border border-[#24262B] bg-[#151518]/60 p-4">
                                        <div className="relative flex h-full flex-col justify-between">
                                            <div className="absolute inset-x-0 top-1/4 border-t border-[#24262B]" />
                                            <div className="absolute inset-x-0 top-1/2 border-t border-[#24262B]" />
                                            <div className="absolute inset-x-0 top-3/4 border-t border-[#24262B]" />

                                            <div className="absolute inset-x-4 bottom-12 top-6">
                                                <svg
                                                    viewBox="0 0 500 120"
                                                    preserveAspectRatio="none"
                                                    className="size-full overflow-visible"
                                                >
                                                    <defs>
                                                        <linearGradient
                                                            id="marketGradient"
                                                            x1="0"
                                                            y1="0"
                                                            x2="0"
                                                            y2="1"
                                                        >
                                                            <stop
                                                                offset="0%"
                                                                stopColor="#79AFFF"
                                                                stopOpacity="0.35"
                                                            />
                                                            <stop
                                                                offset="100%"
                                                                stopColor="#79AFFF"
                                                                stopOpacity="0.0"
                                                            />
                                                        </linearGradient>
                                                    </defs>
                                                    <path
                                                        d={
                                                            isPositive
                                                                ? "M0,90 Q120,80 200,60 T350,35 T500,20 L500,120 L0,120 Z"
                                                                : "M0,30 Q120,45 200,65 T350,85 T500,105 L500,120 L0,120 Z"
                                                        }
                                                        fill="url(#marketGradient)"
                                                    />
                                                    <path
                                                        d={
                                                            isPositive
                                                                ? "M0,90 Q120,80 200,60 T350,35 T500,20"
                                                                : "M0,30 Q120,45 200,65 T350,85 T500,105"
                                                        }
                                                        fill="none"
                                                        stroke="#79AFFF"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                    />
                                                </svg>
                                            </div>

                                            <div className="flex justify-between pt-2 text-[10px] text-[#555A63]">
                                                <span>00:00</span>
                                                <span>06:00</span>
                                                <span>12:00</span>
                                                <span>18:00</span>
                                                <span>Now</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        ) : null}

                        {activeTab === "activity" ? (
                            <section className="rounded-3xl border border-[#24262B] bg-[#0D0D0F] p-6 sm:p-7">
                                <div>
                                    <h2 className="text-base font-semibold text-[#F5F7FA]">
                                        Activity History
                                    </h2>
                                    <p className="mt-0.5 text-xs text-[#8B9099]">
                                        Recent transactions and completed
                                        sessions for {creator.name}
                                    </p>
                                </div>

                                <div className="mt-6 space-y-3">
                                    {[
                                        {
                                            action: `Time purchased (${creator.name})`,
                                            amount: "30 minutes",
                                            time: "35m ago",
                                            type: "buy",
                                        },
                                        {
                                            action: `1-on-1 session completed`,
                                            amount: "15 minutes",
                                            time: "3h ago",
                                            type: "session",
                                        },
                                        {
                                            action: `Time listed`,
                                            amount: "120 minutes",
                                            time: "1d ago",
                                            type: "list",
                                        },
                                    ].map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between rounded-2xl border border-[#24262B] bg-[#151518] px-4 py-3.5"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-9 items-center justify-center rounded-xl border border-[#24262B] bg-[#0D0D0F] text-[#79AFFF]">
                                                    <Clock className="size-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-[#F5F7FA]">
                                                        {item.action}
                                                    </p>
                                                    <p className="text-[11px] text-[#8B9099]">
                                                        {item.amount}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-[#8B9099]">
                                                {item.time}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        {activeTab === "reviews" ? (
                            <section className="rounded-3xl border border-[#24262B] bg-[#0D0D0F] p-6 sm:p-7">
                                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-b border-[#24262B] pb-6">
                                    <div>
                                        <h2 className="text-base font-semibold text-[#F5F7FA]">
                                            Reviews & Ratings
                                        </h2>
                                        <p className="mt-0.5 text-xs text-[#8B9099]">
                                            Verified feedback from session
                                            participants
                                        </p>
                                    </div>

                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-semibold text-[#F5F7FA]">
                                            {creator.rating.toFixed(2)}
                                        </span>
                                        <div className="flex items-center text-amber-400">
                                            <Star className="size-4 fill-amber-400" />
                                            <Star className="size-4 fill-amber-400" />
                                            <Star className="size-4 fill-amber-400" />
                                            <Star className="size-4 fill-amber-400" />
                                            <Star className="size-4 fill-amber-400" />
                                        </div>
                                        <span className="text-xs text-[#8B9099]">
                                            out of 5.0
                                        </span>
                                    </div>
                                </div>

                                <div className="flex min-h-[220px] flex-col items-center justify-center text-center py-10">
                                    <div className="flex size-12 items-center justify-center rounded-2xl border border-[#24262B] bg-[#151518] text-[#8B9099]">
                                        <Star className="size-6" />
                                    </div>
                                    <p className="mt-4 text-sm font-semibold text-[#F5F7FA]">
                                        No reviews yet
                                    </p>
                                    <p className="mt-1.5 max-w-xs text-xs text-[#8B9099]">
                                        Reviews will appear here once sessions
                                        with {creator.name} are completed.
                                    </p>
                                </div>
                            </section>
                        ) : null}
                    </div>

                    <div className="min-w-0">
                        <div className="sticky top-24 space-y-5">
                            <Card className="rounded-3xl border border-[#24262B] bg-[#0D0D0F] p-6 shadow-xl">
                                <div className="grid grid-cols-2 rounded-xl border border-[#24262B] bg-[#151518] p-1">
                                    <button
                                        type="button"
                                        onClick={() => setTradeMode("buy")}
                                        className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                                            tradeMode === "buy"
                                                ? "bg-[#79AFFF] text-[#050505] shadow-sm"
                                                : "text-[#8B9099] hover:text-[#F5F7FA]"
                                        }`}
                                    >
                                        Buy Time
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTradeMode("sell")}
                                        className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                                            tradeMode === "sell"
                                                ? "bg-[#24262B] text-[#F5F7FA] shadow-sm"
                                                : "text-[#8B9099] hover:text-[#F5F7FA]"
                                        }`}
                                    >
                                        Sell
                                    </button>
                                </div>

                                <div className="mt-6 flex items-baseline justify-between border-b border-[#24262B] pb-5">
                                    <div>
                                        <p className="text-xs text-[#8B9099]">
                                            Current price
                                        </p>
                                        <div className="mt-1 flex items-baseline gap-1.5">
                                            <span className="text-2xl font-bold tracking-tight text-[#F5F7FA]">
                                                {creator.price}
                                            </span>
                                            <span className="text-xs text-[#8B9099]">
                                                / min
                                            </span>
                                        </div>
                                    </div>

                                    <div
                                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                            isPositive
                                                ? "bg-[#22C55E]/10 text-[#22C55E]"
                                                : "bg-[#EF4444]/10 text-[#EF4444]"
                                        }`}
                                    >
                                        {isPositive ? (
                                            <TrendingUp className="size-3.5" />
                                        ) : (
                                            <TrendingDown className="size-3.5" />
                                        )}
                                        <span>
                                            {isPositive ? "+" : ""}
                                            {creator.change.toFixed(2)}%
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-4 mb-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[11px] text-[#8B9099]">Price History</p>
                                        <div className="flex items-center rounded-lg border border-[#24262B] bg-[#151518] p-0.5">
                                            {(["1D", "1W", "1M", "1Y"] as ChartTimeframe[]).map((period) => (
                                                <button
                                                    key={period}
                                                    type="button"
                                                    onClick={() => setCreatorTimeframe(period)}
                                                    className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                                        creatorTimeframe === period
                                                            ? "bg-[#24262B] text-[#F5F7FA]"
                                                            : "text-[#8B9099] hover:text-[#F5F7FA]"
                                                    }`}
                                                >
                                                    {period}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <WorthChart
                                        data={creatorChartData}
                                        compact={true}
                                        showVolume={false}
                                        referencePrice={numericPrice}
                                        timeframe={creatorTimeframe}
                                    />
                                </div>

                                <div className="mt-5 border-t border-[#24262B] pt-5">
                                    <p className="text-xs font-medium text-[#8B9099]">
                                        Select minutes
                                    </p>

                                    <div className="mt-2.5 grid grid-cols-3 gap-2">
                                        {[15, 30, 60].map((mins) => {
                                            const isSelected =
                                                !isCustom &&
                                                selectedMinutes === mins;
                                            return (
                                                <button
                                                    key={mins}
                                                    type="button"
                                                    onClick={() => {
                                                        setIsCustom(false);
                                                        setSelectedMinutes(
                                                            mins
                                                        );
                                                    }}
                                                    className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                                                        isSelected
                                                            ? "border-[#79AFFF] bg-[#79AFFF]/10 text-[#79AFFF]"
                                                            : "border-[#24262B] bg-[#151518] text-[#8B9099] hover:border-[#79AFFF]/40 hover:text-[#F5F7FA]"
                                                    }`}
                                                >
                                                    {mins} min
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-3">
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="1"
                                                placeholder="Custom minutes"
                                                value={customMinutes}
                                                onChange={(e) => {
                                                    setIsCustom(true);
                                                    setCustomMinutes(
                                                        e.target.value
                                                    );
                                                }}
                                                className={`w-full rounded-xl border bg-[#151518] px-3.5 py-2.5 text-xs text-[#F5F7FA] outline-none transition-all placeholder:text-[#555A63] ${
                                                    isCustom
                                                        ? "border-[#79AFFF] ring-1 ring-[#79AFFF]/30"
                                                        : "border-[#24262B] focus:border-[#79AFFF]/50"
                                                }`}
                                            />
                                            <span className="pointer-events-none absolute right-3.5 top-2.5 text-xs text-[#8B9099]">
                                                min
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 rounded-2xl border border-[#24262B] bg-[#151518] p-4">
                                    <div className="flex items-center justify-between text-xs text-[#8B9099]">
                                        <span>Total minutes</span>
                                        <span className="font-medium text-[#F5F7FA]">
                                            {activeMinutes} min
                                        </span>
                                    </div>

                                    <div className="mt-2 flex items-center justify-between text-xs text-[#8B9099]">
                                        <span>Estimated total</span>
                                        <span className="text-base font-bold text-[#F5F7FA]">
                                            ${totalCost}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <Button
                                        className="h-11 w-full text-sm font-semibold"
                                        onClick={handleTradeSubmit}
                                    >
                                        {!ready || !authenticated ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <Lock className="size-4" />
                                                Login to{" "}
                                                {tradeMode === "buy"
                                                    ? "Buy Time"
                                                    : "Sell"}
                                            </span>
                                        ) : tradeMode === "buy" ? (
                                            `Buy ${activeMinutes} Minutes`
                                        ) : (
                                            `Sell Minutes`
                                        )}
                                    </Button>
                                </div>
                            </Card>


                            <Card className="rounded-3xl border border-[#24262B] bg-[#0D0D0F] p-6 shadow-xl">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-[#F5F7FA]">
                                        Your Position
                                    </h3>
                                    <Wallet className="size-4 text-[#8B9099]" />
                                </div>

                                {ready && authenticated ? (
                                    <div className="mt-4 space-y-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-[#8B9099]">
                                                Owned minutes
                                            </span>
                                            <span className="font-semibold text-[#F5F7FA]">
                                                0 min
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-[#8B9099]">
                                                Current value
                                            </span>
                                            <span className="font-semibold text-[#F5F7FA]">
                                                $0.00
                                            </span>
                                        </div>

                                        <p className="pt-2 text-center text-xs text-[#8B9099]">
                                            No active position in {creator.name}
                                            .
                                        </p>
                                    </div>
                                ) : (
                                    <div className="mt-4 flex flex-col items-center justify-center py-2 text-center">
                                        <p className="text-xs text-[#8B9099]">
                                            Login to view your position.
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                login()
                                            }
                                            className="mt-3 border-[#24262B] bg-[#151518] text-xs text-[#F5F7FA] hover:border-[#79AFFF]/40 hover:bg-[#1a1a20]"
                                        >
                                            Login
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
