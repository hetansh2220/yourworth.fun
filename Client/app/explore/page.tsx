"use client";

import Link from "next/link";
import { ArrowUpRight, Flame, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HeroCreatorTile } from "@/components/explore/hero-creator-tile";
import { CategoryNav } from "@/components/explore/category-nav";
import {
    CreatorCard,
    type CreatorCardProps,
} from "@/components/explore/creator-card";

const creatorImages = [
    "https://i.pinimg.com/736x/9c/31/41/9c3141c276232e4f9ea2f9eba3028836.jpg",
    "https://tse4.mm.bing.net/th/id/OIP.JD7RaPoEbeXyNMf3xE32NgHaI0?r=0&pid=ImgDet&w=184&h=219&c=7&dpr=1.3&o=7&rm=3",
    "https://tse1.mm.bing.net/th/id/OIP.dRIQgCJ1ExaBxrZwp5LRkQHaJ4?r=0&pid=ImgDet&w=202&h=269&c=7&dpr=1.3&o=7&rm=3",
    "https://tse4.mm.bing.net/th/id/OIP.Tgv_iBl4QPxqJATW37fPqgAAAA?r=0&pid=ImgDet&w=198&h=223&c=7&dpr=1.3&o=7&rm=3",
    "https://tse4.mm.bing.net/th/id/OIP.t5ANlYOtbT3aNJNlzoInxQAAAA?r=0&pid=ImgDet&w=191&h=191&c=7&dpr=1.3&o=7&rm=3",
];

const heroTiles = [
    {
        image: creatorImages[0],
        className: "hidden -translate-y-[34%] -rotate-3 sm:block",
    },
    { image: creatorImages[1], className: "-translate-y-[22%] -rotate-2" },
    { image: creatorImages[2], className: "-translate-y-[12%] -rotate-1" },
    { image: creatorImages[3], className: "-translate-y-[6%]" },
    { image: creatorImages[4], className: "-translate-y-[12%] rotate-1" },
    { image: creatorImages[0], className: "-translate-y-[22%] rotate-2" },
    {
        image: creatorImages[1],
        className: "hidden -translate-y-[34%] rotate-3 sm:block",
    },
];

const topCreators: CreatorCardProps[] = [
    {
        name: "Satoru Nakamoto",
        username: "@satoru",
        image: creatorImages[0],
        rating: 4.98,
        price: "$14.50",
        change: 18.25,
        description: "Autonomous AI agent architect & open-source contributor.",
    },
    {
        name: "Elena Rostova",
        username: "@elena_ux",
        image: creatorImages[1],
        rating: 4.95,
        price: "$8.75",
        change: 9.4,
        description: "Principal product designer shaping spatial interfaces.",
    },
    {
        name: "Marcus Vance",
        username: "@mvance",
        image: creatorImages[2],
        rating: 4.91,
        price: "$19.00",
        change: -3.12,
        description: "Early-stage investor backing decentralized systems.",
    },
    {
        name: "Aria Sterling",
        username: "@ariasterling",
        image: creatorImages[3],
        rating: 4.89,
        price: "$6.20",
        change: 24.15,
        description:
            "Electronic music producer, audio engineer, and sound artist.",
    },
    {
        name: "Kenji Sato",
        username: "@kenji_sol",
        image: creatorImages[4],
        rating: 4.97,
        price: "$12.00",
        change: 6.8,
        description:
            "Solana core dev and high-frequency trading protocol engineer.",
    },
    {
        name: "Chloe Chen",
        username: "@chloec",
        image: creatorImages[2],
        rating: 4.93,
        price: "$10.50",
        change: 12.3,
        description:
            "Creative director & growth strategist for next-gen consumer apps.",
    },
];

export default function ExplorePage() {
    return (
        <main className="min-h-screen overflow-x-hidden bg-[#050505] text-[#F5F7FA]">
            <nav className="border-b border-[#24262B] bg-[#050505]">
                <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-5 sm:px-8">
                    <Link
                        href="/explore"
                        className="text-xl font-bold tracking-[0.18em]"
                    >
                        <span className="text-[#79AFFF]">W</span>ORTH
                    </Link>

                    <div className="hidden items-center gap-7 text-sm md:flex">
                        <Link
                            href="/explore"
                            className="text-[#F5F7FA] hover:text-[#79AFFF]"
                        >
                            Explore
                        </Link>

                        <Link
                            href="/portfolio"
                            className="text-[#8B9099] hover:text-[#79AFFF]"
                        >
                            Portfolio
                        </Link>

                        <Link
                            href="/community"
                            className="text-[#8B9099] hover:text-[#79AFFF]"
                        >
                            Community
                        </Link>
                    </div>

                    <Link href="/login">
                        <Button>Login</Button>
                    </Link>
                </div>
            </nav>

            <section className="relative overflow-hidden border-b border-[#24262B] bg-[#050505]">
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

                <div className="relative z-20 mx-auto flex max-w-[1400px] flex-col items-center px-5 pb-[130px] pt-14 text-center sm:px-8 sm:pb-[200px] md:pb-[280px] lg:pb-[360px] lg:pt-10">
                    <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                        What's your
                        <br />
                        <span className="text-primary">time worth?</span>
                    </h1>

                    <p className="mt-7 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
                        Discover people, explore their value, and access their
                        time.
                    </p>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                        <Link href="/explore">
                            <Button>
                                Explore creators
                                <ArrowUpRight className="ml-2 size-4" />
                            </Button>
                        </Link>

                        <Link href="/login">
                            <Button
                                variant="outline"
                                className="border-[#2A2D33] border-t-3 border-t-[#34383F] bg-[#101014] text-lg font-semibold text-[#F5F7FA] hover:border-[#79AFFF]/40 hover:bg-[#17171C] hover:text-[#F5F7FA]"
                            >
                                Get paid for your time
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-8 z-10 sm:bottom-14 lg:bottom-30">
                    <div className="mx-auto grid max-w-[1500px] grid-cols-5 items-end gap-2 px-2 sm:grid-cols-7 sm:gap-3 sm:px-3">
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

            <CategoryNav />

            <section className="w-full bg-[#050505] py-8 sm:py-10">
                <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
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
