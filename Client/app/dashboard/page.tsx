"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    BarChart3,
    ChevronDown,
    ChevronRight,
    Trophy,
    Wallet,
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useCurrentUser } from "@/hooks/users/use-current-user";
import { AppSidebar, MobileNavDrawer } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { PageSpinner } from "@/components/layout/page-spinner";
import { WorthChart } from "@/components/charts/worth-chart";
import { getMockHistoricalData, type ChartTimeframe } from "@/data/chart-data";
import { getCreatorByUsername } from "@/data/creators";

const trendingCreators = [
    {
        name: "Mira",
        username: "@mira",
        image: "https://pbs.twimg.com/profile_images/2075257710715781123/74AtQPd6_400x400.jpg",
        price: "$78.60",
        change: "+36%",
    },
    {
        name: "Dev",
        username: "@devr",
        image: "https://pbs.twimg.com/profile_images/1984256809427955712/H9T9bSeV_400x400.jpg",
        price: "$54.20",
        change: "+12%",
    },
    {
        name: "Sol",
        username: "@solvega",
        image: "https://pbs.twimg.com/profile_images/1773988714462461952/woSArAj4_400x400.jpg",
        price: "$31.40",
        change: "-4%",
    },
    {
        name: "Kito",
        username: "@kitoabe",
        image: "https://pbs.twimg.com/profile_images/1744808919518822400/tYvudcDg_400x400.jpg",
        price: "$22.05",
        change: "+9%",
    },
];

const recentActivity = [
    {
        title: "You followed Mira Okonkwo",
        time: "2h ago",
    },
    {
        title: "You viewed Dev Raman",
        time: "5h ago",
    },
    {
        title: "You saved Sol Vega",
        time: "Yesterday",
    },
];

export default function DashboardPage() {
    const router = useRouter();
    const { ready, authenticated, user } = usePrivy();
    const currentUserQuery = useCurrentUser();
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [timeframe, setTimeframe] = useState<ChartTimeframe>("1D");
    console.log(user);
    useEffect(() => {
        if (ready && !authenticated) {
            router.replace("/");
        }
    }, [authenticated, ready, router]);

    const username = currentUserQuery.data?.user?.username;

    const userCreator = username ? getCreatorByUsername(username) : null;
    const numericUserPrice = userCreator
        ? parseFloat(userCreator.price.replace(/[^0-9.]/g, "")) || 0
        : 0;

    const userChartIdentifier = username
        ? `user_${username}`
        : "me_worth_history";
    const chartData = useMemo(() => {
        return getMockHistoricalData(
            userChartIdentifier,
            timeframe,
            numericUserPrice,
            userCreator?.change ?? 0,
        );
    }, [userChartIdentifier, timeframe, numericUserPrice, userCreator]);

    const chartTitle = userCreator
        ? `${userCreator.name}'s WORTH`
        : username
          ? `@${username}'s WORTH`
          : "My WORTH";

    const displayPrice = userCreator ? userCreator.price : "$0.00";
    const displayChange = userCreator
        ? `${userCreator.change >= 0 ? "+" : ""}${userCreator.change.toFixed(2)}%`
        : "0.00%";

    if (ready && !authenticated) {
        return <PageSpinner label="Redirecting" />;
    }

    return (
        <main className="min-h-screen bg-[#050505] text-[#F5F7FA]">
            <div className="flex min-h-screen">
                <AppSidebar />
                <MobileNavDrawer
                    isOpen={isMobileNavOpen}
                    onClose={() => setIsMobileNavOpen(false)}
                />

                <div className="min-w-0 flex-1 lg:pl-[72px]">
                    <AppHeader
                        title="Dashboard"
                        subtitle={`Welcome back${username ? `, @${username}` : ""}`}
                        onMenuClick={() => setIsMobileNavOpen(true)}
                    />

                    <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                            <section className="min-w-0">
                                <div>
                                    <p className="text-sm text-[#8B9099]">
                                        My worth
                                    </p>
                                    <div className="mt-1 flex items-end gap-3">
                                        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                                            {displayPrice}
                                        </h1>
                                        <span
                                            className={`mb-1 text-xs ${
                                                userCreator
                                                    ? userCreator.change >= 0
                                                        ? "text-[#22C55E]"
                                                        : "text-[#EF4444]"
                                                    : "text-[#8B9099]"
                                            }`}
                                        >
                                            {displayChange}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-7 rounded-3xl border border-[#24262B] bg-[#0D0D0F] p-6 shadow-xl">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-semibold text-[#F5F7FA]">
                                                {chartTitle}
                                            </h3>
                                            <p className="mt-0.5 text-xs text-[#8B9099]">
                                                Historical minute valuation
                                            </p>
                                        </div>
                                        <div className="flex items-center rounded-xl border border-[#24262B] bg-[#151518] p-1">
                                            {(
                                                [
                                                    "1D",
                                                    "1W",
                                                    "1M",
                                                    "1Y",
                                                ] as ChartTimeframe[]
                                            ).map((period) => (
                                                <button
                                                    key={period}
                                                    type="button"
                                                    onClick={() =>
                                                        setTimeframe(period)
                                                    }
                                                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                                        timeframe === period
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
                                        data={chartData}
                                        compact={true}
                                        showVolume={false}
                                        referencePrice={
                                            numericUserPrice > 0
                                                ? numericUserPrice
                                                : undefined
                                        }
                                        timeframe={timeframe}
                                    />
                                </div>

                                <div className="mt-5 border-y border-[#24262B] py-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold">
                                                Total balance
                                            </p>
                                            <p className="mt-1 text-xs text-[#8B9099]">
                                                Your available WORTH balance
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-semibold">
                                                $0.00
                                            </span>
                                            <ChevronDown className="size-4 text-[#8B9099]" />
                                        </div>
                                    </div>
                                </div>

                                <section className="mt-8">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-sm font-semibold">
                                                Recent activity
                                            </h2>
                                            <p className="mt-1 text-xs text-[#8B9099]">
                                                Your latest activity on WORTH
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            className="text-xs font-medium text-[#79AFFF] hover:text-[#F5F7FA]"
                                        >
                                            View all
                                        </button>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        {recentActivity.map((activity) => (
                                            <div
                                                key={activity.title}
                                                className="flex items-center justify-between rounded-xl border border-[#24262B] bg-[#0D0D0F] px-4 py-3"
                                            >
                                                <p className="text-xs text-[#F5F7FA]">
                                                    {activity.title}
                                                </p>
                                                <span className="text-[11px] text-[#8B9099]">
                                                    {activity.time}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="mt-9">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-sm font-semibold">
                                                Trending creators
                                            </h2>
                                            <p className="mt-1 text-xs text-[#8B9099]">
                                                People getting attention right
                                                now
                                            </p>
                                        </div>

                                        <Link
                                            href="/explore  "
                                            className="flex items-center gap-1 text-xs font-medium text-[#79AFFF]"
                                        >
                                            Show more
                                            <ChevronRight className="size-3.5" />
                                        </Link>
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        {trendingCreators.map((creator) => (
                                            <Link
                                                key={creator.username}
                                                href="/"
                                                className="group rounded-2xl border border-[#24262B] bg-[#0D0D0F] p-3 transition-colors hover:border-[#79AFFF]/30 hover:bg-[#151518]"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={creator.image}
                                                        alt={creator.name}
                                                        className="size-11 rounded-xl object-cover"
                                                    />

                                                    <div className="min-w-0">
                                                        <p className="truncate text-xs font-semibold">
                                                            {creator.name}
                                                        </p>
                                                        <p className="truncate text-[11px] text-[#8B9099]">
                                                            {creator.username}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex items-center justify-between">
                                                    <span className="text-xs font-semibold">
                                                        {creator.price}
                                                        <span className="ml-1 font-normal text-[#8B9099]">
                                                            /min
                                                        </span>
                                                    </span>

                                                    <span className="text-[10px] font-medium text-[#22C55E]">
                                                        {creator.change}
                                                    </span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </section>
                            </section>

                            <aside className="space-y-5">
                                <Link
                                    href="/complete-profile"
                                    className="group block overflow-hidden rounded-2xl border border-[#79AFFF]/30 bg-[#0D0D0F] p-4 transition-colors hover:border-[#79AFFF]/60"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold">
                                                Create your WORTH
                                            </p>
                                            <p className="mt-1 text-xs text-[#8B9099]">
                                                Get paid for your time
                                            </p>
                                        </div>

                                        <ChevronRight className="size-4 text-[#79AFFF] transition-transform group-hover:translate-x-1" />
                                    </div>
                                </Link>

                                <section className="rounded-2xl border border-[#24262B] bg-[#0D0D0F] p-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-sm font-semibold">
                                                Leaderboard
                                            </h2>
                                            <p className="mt-1 text-xs text-[#8B9099]">
                                                Earn recognition across WORTH
                                            </p>
                                        </div>

                                        <Trophy className="size-4 text-[#79AFFF]" />
                                    </div>

                                    <div className="mt-6 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-[#8B9099]">
                                                Rank
                                            </span>
                                            <span className="text-xs font-semibold">
                                                #1
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-[#8B9099]">
                                                Points earned
                                            </span>
                                            <span className="text-xs font-semibold">
                                                0
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="mt-6 w-full rounded-xl border border-[#24262B] bg-[#151518] py-2.5 text-xs font-medium transition-colors hover:border-[#79AFFF]/40 hover:text-[#79AFFF]"
                                    >
                                        Go to leaderboard
                                    </button>
                                </section>

                                <section className="rounded-2xl border border-[#24262B] bg-[#0D0D0F] p-5">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-sm font-semibold">
                                            My holdings
                                        </h2>
                                        <Wallet className="size-4 text-[#8B9099]" />
                                    </div>

                                    <div className="flex min-h-[190px] flex-col items-center justify-center text-center">
                                        <div className="flex size-12 items-center justify-center rounded-2xl border border-[#24262B] bg-[#151518]">
                                            <Wallet className="size-5 text-[#8B9099]" />
                                        </div>

                                        <p className="mt-4 text-sm font-semibold">
                                            Nothing here yet
                                        </p>

                                        <p className="mt-2 max-w-[220px] text-xs leading-5 text-[#8B9099]">
                                            Discover people and get access to
                                            the time worth buying.
                                        </p>

                                        <Link
                                            href="/explore"
                                            className="mt-5 rounded-xl bg-[#79AFFF] px-4 py-2.5 text-xs font-semibold text-[#050505] transition-colors hover:bg-[#8DBAFF]"
                                        >
                                            Explore creators
                                        </Link>
                                    </div>
                                </section>

                                <section className="rounded-2xl border border-[#24262B] bg-[#0D0D0F] p-5">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-sm font-semibold">
                                            Watchlist
                                        </h2>
                                        <BarChart3 className="size-4 text-[#8B9099]" />
                                    </div>

                                    <div className="flex min-h-[170px] flex-col items-center justify-center text-center">
                                        <div className="flex size-12 items-center justify-center rounded-2xl border border-[#24262B] bg-[#151518]">
                                            <BarChart3 className="size-5 text-[#8B9099]" />
                                        </div>

                                        <p className="mt-4 text-sm font-semibold">
                                            Nothing here yet
                                        </p>

                                        <p className="mt-2 max-w-[220px] text-xs leading-5 text-[#8B9099]">
                                            Save creators you want to keep an
                                            eye on.
                                        </p>
                                    </div>
                                </section>
                            </aside>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
