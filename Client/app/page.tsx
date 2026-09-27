"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Flame, ChevronRight } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useCurrentUser } from "@/hooks/users/use-current-user";
import { ApiError } from "@/api";

import { Button } from "@/components/ui/button";
import { HeroCreatorTile } from "@/components/explore/hero-creator-tile";
import { Navbar } from "@/components/layout/navbar";
import { PageSpinner } from "@/components/layout/page-spinner";
import { CategoryNav } from "@/components/explore/category-nav";
import { CreatorCard } from "@/components/explore/creator-card";
import { creatorImages, creators as topCreators } from "@/data/creators";

const heroTiles = [
    {
        image: creatorImages[0],
        className: "hidden -translate-y-[22%] -rotate-3 sm:block",
    },
    { image: creatorImages[1], className: "-translate-y-[14%] -rotate-2" },
    { image: creatorImages[2], className: "-translate-y-[7%] -rotate-1" },
    { image: creatorImages[3], className: "translate-y-0" },
    { image: creatorImages[4], className: "-translate-y-[7%] rotate-1" },
    { image: creatorImages[5], className: "-translate-y-[14%] rotate-2" },
    {
        image: creatorImages[6],
        className: "hidden -translate-y-[22%] rotate-3 sm:block",
    },
];

export default function ExplorePage() {
    const router = useRouter();
    const { ready, authenticated, login } = usePrivy();
    const currentUserQuery = useCurrentUser();
    const profileMissing =
        currentUserQuery.error instanceof ApiError &&
        currentUserQuery.error.status === 404;

    const isCheckingAuthenticatedProfile =
        ready &&
        authenticated &&
        (currentUserQuery.isLoading ||
            currentUserQuery.isFetching ||
            Boolean(currentUserQuery.data?.user) ||
            profileMissing);

    if (isCheckingAuthenticatedProfile) {
        return (
            <PageSpinner
                label={profileMissing ? "Opening profile" : "Loading dashboard"}
            />
        );
    }

    const handleExploreClick = () => {
        if (ready && authenticated) {
            router.push("/explore");
        } else {
            login();
        }
    };

    const handleGetPaidClick = () => {
        if (ready && authenticated) {
            if (profileMissing) {
                router.push("/complete-profile");
            } else {
                router.push("/dashboard");
            }
        } else {
            login();
        }
    };

    return (
        <main className="min-h-screen overflow-x-hidden bg-[#050505] text-[#F5F7FA]">
            <Navbar />

            <section className="relative min-h-[calc(100svh-72px)] overflow-hidden border-b border-[#24262B] bg-[#050505]">
                <div
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{
                        backgroundImage:
                            "linear-gradient(#24262B 1px, transparent 1px), linear-gradient(90deg, #24262B 1px, transparent 1px)",
                        backgroundSize: "64px 64px",
                        maskImage:
                            "linear-gradient(to bottom, black, transparent)",
                    }}
                />

                <div className="relative z-20 mx-auto flex min-h-[calc(100svh-72px)] max-w-[1400px] flex-col items-center px-5 pb-[250px] pt-16 text-center sm:px-8 sm:pb-[290px] sm:pt-20 md:pb-[315px] lg:pb-[345px] lg:pt-[88px] xl:pb-[360px]">
                    <h1 className="max-w-3xl text-5xl font-semibold leading-[0.96] tracking-normal text-[#F5F7FA] sm:text-6xl md:text-7xl lg:text-8xl">
                        What&apos;s your
                        <br />
                        <span className="text-primary">time worth?</span>
                    </h1>

                    <p className="mt-7 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
                        Discover people, access their time, and value your own.
                    </p>

                    <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                        <Button
                            onClick={handleExploreClick}
                            className="cursor-pointer"
                        >
                            Explore creators
                            <ArrowUpRight className="ml-2 size-4" />
                        </Button>

                        <Button
                            onClick={handleGetPaidClick}
                            variant="outline"
                            className="cursor-pointer border-[#2A2D33] border-t-3 border-t-[#34383F] bg-[#101014] text-lg font-semibold text-[#F5F7FA] hover:border-[#79AFFF]/40 hover:bg-[#17171C] hover:text-[#F5F7FA]"
                        >
                            Get paid for your time
                        </Button>
                    </div>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-8 z-10 sm:bottom-10 lg:bottom-8 xl:bottom-10">
                    <div className="mx-auto grid max-w-[1940px] grid-cols-5 items-end gap-2 px-2 sm:grid-cols-7 sm:gap-3 sm:px-3 lg:gap-4">
                        {heroTiles.map((tile, index) => (
                            <HeroCreatorTile
                                key={index}
                                image={tile.image}
                                className={tile.className}
                            />
                        ))}
                    </div>
                </div>
            </section>

            <CategoryNav showScrollButton={false} />

            <section className="w-full bg-[#050505] py-8 sm:py-10">
                <div className="w-full px-3 sm:px-5 lg:px-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                            <div className="flex size-11 items-center justify-center rounded-2xl border border-[#24262B] bg-[#0D0D0F] shadow-sm">
                                <Flame className="size-5 text-[#79AFFF]" />
                            </div>

                            <div>
                                <h2 className="text-lg font-semibold tracking-tight text-[#F5F7FA]">
                                    Top Creators
                                </h2>
                                <p className="text-xs text-[#8B9099]">
                                    Featured Creators
                                </p>
                            </div>
                        </div>

                        <Link href="/explore">
                            <button
                                type="button"
                                className="group flex items-center gap-1.5 rounded-xl border border-[#24262B] bg-[#0D0D0F] px-4 py-2 text-xs font-medium text-[#F5F7FA] transition-all hover:border-[#79AFFF]/40 hover:bg-[#151518]"
                            >
                                <span>See all</span>
                                <ChevronRight className="size-3.5 text-[#8B9099] transition-transform group-hover:translate-x-0.5 group-hover:text-[#F5F7FA]" />
                            </button>
                        </Link>
                    </div>

                    <div className="mt-6 flex items-stretch gap-4 overflow-x-auto pb-6 pt-1 sm:gap-5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {topCreators.map((creator, index) => (
                            <CreatorCard key={index} {...creator} />
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}
