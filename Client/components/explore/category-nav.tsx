"use client";

import { useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

type Category = {
    id: string;
    label: string;
};

const categories: Category[] = [
    { id: "all", label: "All Creators" },
    { id: "top", label: "Top Creators" },
    { id: "founders", label: "Founders" },
    { id: "influencers", label: "Influencers" },
    { id: "investors", label: "Investors" },
    { id: "ui-ux", label: "UI/UX Design" },
    { id: "athletes", label: "Athletes" },
    { id: "solana", label: "Solana" },
    { id: "musicians", label: "Musicians" },
    { id: "media-marketing", label: "Media & Marketing" },
];

type CategoryNavProps = {
    activeCategory?: string;
    onSelectCategory?: (id: string) => void;
    className?: string;
    showScrollButton?: boolean;
};

export function CategoryNav({
    activeCategory,
    onSelectCategory,
    className = "",
    showScrollButton = false,
}: CategoryNavProps) {
    const [internalSelected, setInternalSelected] = useState(activeCategory || "all");
    const scrollRef = useRef<HTMLDivElement>(null);

    const selected = activeCategory !== undefined ? activeCategory : internalSelected;

    const handleSelect = (id: string) => {
        setInternalSelected(id);
        onSelectCategory?.(id);
    };

    const handleScrollRight = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({
                left: 240,
                behavior: "smooth",
            });
        }
    };

    return (
        <section className={`relative w-full border-[#24262B] bg-[#050505] ${className}`}>
            <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 sm:px-8">
                <div
                    ref={scrollRef}
                    className="flex flex-1 items-center gap-8 overflow-x-auto py-3.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                    {categories.map((cat) => {
                        const isActive = selected === cat.id;

                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleSelect(cat.id)}
                                className={`group relative flex shrink-0 items-center justify-center text-xs font-medium transition-colors ${
                                    isActive
                                        ? "text-[#79AFFF]"
                                        : "text-[#8B9099] hover:text-[#F5F7FA]"
                                }`}
                            >
                                <span className="whitespace-nowrap tracking-tight">
                                    {cat.label}
                                </span>

                                <div
                                    className={`absolute -bottom-3.5 left-0 h-[2px] w-full rounded-full transition-all ${
                                        isActive ? "bg-[#79AFFF]" : "bg-transparent"
                                    }`}
                                />
                            </button>
                        );
                    })}
                </div>

                {showScrollButton && (
                    <div className="hidden pl-4 md:flex">
                        <button
                            type="button"
                            onClick={handleScrollRight}
                            aria-label="Scroll right"
                            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#24262B] bg-[#151518] text-[#8B9099] transition-colors hover:border-[#79AFFF]/40 hover:bg-[#1f2127] hover:text-[#F5F7FA]"
                        >
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
