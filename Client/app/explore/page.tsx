"use client";

import { useMemo, useState } from "react";
import {
    ArrowUpDown,
    Compass,
    Flame,
    Search,
    X,
} from "lucide-react";

import { AppSidebar, MobileNavDrawer } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { CategoryNav } from "@/components/explore/category-nav";
import { CreatorCard } from "@/components/explore/creator-card";
import { Button } from "@/components/ui/button";
import { creators } from "@/data/creators";

type SortOption = "trending" | "rating" | "price-low" | "price-high" | "gainers";

export default function ExplorePage() {
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [sortBy, setSortBy] = useState<SortOption>("trending");
    const [isSortOpen, setIsSortOpen] = useState(false);

    const filteredAndSortedCreators = useMemo(() => {
        const filtered = creators.filter((creator) => {
            const query = searchQuery.trim().toLowerCase();
            const matchesSearch =
                query === "" ||
                creator.name.toLowerCase().includes(query) ||
                creator.username.toLowerCase().includes(query) ||
                creator.description.toLowerCase().includes(query) ||
                (creator.category && creator.category.toLowerCase().includes(query));

            if (!matchesSearch) return false;

            if (selectedCategory === "all") return true;
            if (selectedCategory === "top")
                return creator.rating >= 4.95 || creator.change >= 10;
            if (selectedCategory === "founders")
                return (
                    creator.category?.includes("Engineering") ||
                    creator.category?.includes("Investing") ||
                    creator.name.includes("Satoru") ||
                    creator.name.includes("Marcus")
                );
            if (selectedCategory === "influencers")
                return (
                    creator.category?.includes("Marketing") ||
                    creator.category?.includes("Music") ||
                    creator.category?.includes("Design")
                );
            if (selectedCategory === "investors")
                return (
                    creator.category?.includes("Investing") ||
                    creator.name.includes("Marcus")
                );
            if (selectedCategory === "ui-ux")
                return (
                    creator.category?.includes("Design") ||
                    creator.name.includes("Elena")
                );
            if (selectedCategory === "athletes")
                return creator.category?.includes("Athletics");
            if (selectedCategory === "solana")
                return (
                    creator.category?.includes("Solana") ||
                    creator.name.includes("Kenji") ||
                    creator.description.toLowerCase().includes("solana")
                );
            if (selectedCategory === "musicians")
                return (
                    creator.category?.includes("Music") ||
                    creator.name.includes("Aria")
                );
            if (selectedCategory === "media-marketing")
                return (
                    creator.category?.includes("Marketing") ||
                    creator.name.includes("Chloe")
                );

            return true;
        });

        return [...filtered].sort((a, b) => {
            if (sortBy === "rating") return b.rating - a.rating;
            if (sortBy === "price-low") {
                const pA = parseFloat(a.price.replace(/[^0-9.]/g, "")) || 0;
                const pB = parseFloat(b.price.replace(/[^0-9.]/g, "")) || 0;
                return pA - pB;
            }
            if (sortBy === "price-high") {
                const pA = parseFloat(a.price.replace(/[^0-9.]/g, "")) || 0;
                const pB = parseFloat(b.price.replace(/[^0-9.]/g, "")) || 0;
                return pB - pA;
            }
            if (sortBy === "gainers") return b.change - a.change;
            return 0;
        });
    }, [searchQuery, selectedCategory, sortBy]);

    const isFilteringOrSearching =
        searchQuery.trim() !== "" || selectedCategory !== "all" || sortBy !== "trending";

    const topCreatorsList = useMemo(() => {
        return creators.filter((c) => c.rating >= 4.93).slice(0, 4);
    }, []);

    const sortLabels: Record<SortOption, string> = {
        trending: "Trending",
        rating: "Highest Rating",
        "price-low": "Price: Low to High",
        "price-high": "Price: High to Low",
        gainers: "Top Gainers",
    };

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
                        title="Explore"
                        subtitle="Discover people worth your time."
                        onMenuClick={() => setIsMobileNavOpen(true)}
                    />

                    <div className="border-b border-[#24262B] bg-[#050505]">
                        <CategoryNav
                            activeCategory={selectedCategory}
                            onSelectCategory={(cat) => setSelectedCategory(cat)}
                            showScrollButton={false}
                        />
                    </div>

                    <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-3xl font-semibold tracking-tight text-[#F5F7FA] sm:text-4xl">
                                    Explore Creators
                                </h1>
                                <p className="mt-1 text-sm text-[#8B9099]">
                                    Discover people, access their time, and value your own.
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="relative w-full sm:w-[280px] lg:w-[320px]">
                                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8B9099]" />
                                    <input
                                        type="text"
                                        placeholder="Search creators..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-10 w-full rounded-xl border border-[#24262B] bg-[#0D0D0F] pl-10 pr-9 text-xs text-[#F5F7FA] placeholder-[#8B9099] outline-none transition-colors focus:border-[#79AFFF]/40 focus:ring-1 focus:ring-[#79AFFF]/30"
                                    />
                                    {searchQuery ? (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B9099] hover:text-[#F5F7FA]"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    ) : null}
                                </div>

                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsSortOpen((prev) => !prev)}
                                        className="flex h-10 items-center gap-2 rounded-xl border border-[#24262B] bg-[#0D0D0F] px-3.5 text-xs font-medium text-[#F5F7FA] transition-colors hover:border-[#79AFFF]/40 hover:bg-[#151518]"
                                    >
                                        <ArrowUpDown className="size-3.5 text-[#8B9099]" />
                                        <span className="hidden sm:inline">
                                            {sortLabels[sortBy]}
                                        </span>
                                        <span className="sm:hidden">Sort</span>
                                    </button>

                                    {isSortOpen ? (
                                        <div className="absolute right-0 z-30 mt-2 w-48 rounded-2xl border border-[#24262B] bg-[#0D0D0F] p-1.5 shadow-2xl">
                                            {(
                                                Object.keys(
                                                    sortLabels
                                                ) as SortOption[]
                                            ).map((option) => (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    onClick={() => {
                                                        setSortBy(option);
                                                        setIsSortOpen(false);
                                                    }}
                                                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                                                        sortBy === option
                                                            ? "bg-[#151518] text-[#79AFFF]"
                                                            : "text-[#8B9099] hover:bg-[#151518] hover:text-[#F5F7FA]"
                                                    }`}
                                                >
                                                    <span>{sortLabels[option]}</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>

                                {isFilteringOrSearching ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setSearchQuery("");
                                            setSelectedCategory("all");
                                            setSortBy("trending");
                                        }}
                                        className="h-10 border-[#24262B] bg-[#0D0D0F] px-3 text-xs text-[#8B9099] hover:border-[#79AFFF]/40 hover:text-[#F5F7FA]"
                                    >
                                        Reset
                                    </Button>
                                ) : null}
                            </div>
                        </div>

                        {isFilteringOrSearching ? (
                            <section className="mt-8">
                                <div className="flex items-center justify-between border-b border-[#24262B] pb-4">
                                    <div>
                                        <h2 className="text-base font-semibold text-[#F5F7FA]">
                                            {searchQuery
                                                ? `Search results for "${searchQuery}"`
                                                : "Filtered Creators"}
                                        </h2>
                                        <p className="mt-0.5 text-xs text-[#8B9099]">
                                            Showing {filteredAndSortedCreators.length} creator
                                            {filteredAndSortedCreators.length === 1 ? "" : "s"}
                                        </p>
                                    </div>
                                </div>

                                {filteredAndSortedCreators.length > 0 ? (
                                    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {filteredAndSortedCreators.map((creator) => (
                                            <CreatorCard
                                                key={creator.username}
                                                {...creator}
                                                className="w-full"
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-[#24262B] bg-[#0D0D0F] p-8 text-center mt-6">
                                        <div className="flex size-14 items-center justify-center rounded-2xl border border-[#24262B] bg-[#151518] text-[#8B9099]">
                                            <Search className="size-6" />
                                        </div>
                                        <h3 className="mt-4 text-base font-semibold text-[#F5F7FA]">
                                            No creators found
                                        </h3>
                                        <p className="mt-1.5 max-w-sm text-xs text-[#8B9099]">
                                            We couldn&apos;t find any creators matching your current
                                            filter or search criteria.
                                        </p>
                                        <Button
                                            onClick={() => {
                                                setSearchQuery("");
                                                setSelectedCategory("all");
                                                setSortBy("trending");
                                            }}
                                            className="mt-5 text-xs font-semibold"
                                        >
                                            Clear all filters
                                        </Button>
                                    </div>
                                )}
                            </section>
                        ) : (
                            <div className="mt-8 space-y-10">
                                <section>
                                    <div className="flex items-center justify-between border-b border-[#24262B] pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-9 items-center justify-center rounded-xl border border-[#24262B] bg-[#0D0D0F] text-[#79AFFF]">
                                                <Flame className="size-4" />
                                            </div>
                                            <div>
                                                <h2 className="text-base font-semibold text-[#F5F7FA]">
                                                    Top Creators
                                                </h2>
                                                <p className="text-xs text-[#8B9099]">
                                                    Highest rated people across WORTH
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {topCreatorsList.map((creator) => (
                                            <CreatorCard
                                                key={`top-${creator.username}`}
                                                {...creator}
                                                className="w-full"
                                            />
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center justify-between border-b border-[#24262B] pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-9 items-center justify-center rounded-xl border border-[#24262B] bg-[#0D0D0F] text-[#79AFFF]">
                                                <Compass className="size-4" />
                                            </div>
                                            <div>
                                                <h2 className="text-base font-semibold text-[#F5F7FA]">
                                                    More Creators
                                                </h2>
                                                <p className="text-xs text-[#8B9099]">
                                                    Browse talent available for time booking
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {creators.map((creator) => (
                                            <CreatorCard
                                                key={`all-${creator.username}`}
                                                {...creator}
                                                className="w-full"
                                            />
                                        ))}
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}