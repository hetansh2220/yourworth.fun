"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BadgeCheck } from "lucide-react";

export type CreatorCardProps = {
    name: string;
    username: string;
    image: string;
    rating: number;
    price: string;
    change: number;
    description: string;
    className?: string;
};

export function CreatorCard({
    name,
    username,
    image,
    rating,
    price,
    change,
    description,
    className = "",
}: CreatorCardProps) {
    const router = useRouter();
    const isPositive = change >= 0;

    const cleanUsername = username.replace(/^@/, "");

    return (
        <Card
            className={`flex flex-col gap-0 overflow-hidden rounded-[28px] border-0 bg-card p-2 ${
                className || "w-[300px] shrink-0"
            }`}
        >
            <div className="relative overflow-hidden rounded-[22px]">
                <img
                    src={image}
                    alt={name}
                    className="aspect-[1/0.85] w-full object-cover"
                />

                <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-sm font-medium text-white">
                    ★ {rating}
                </div>
            </div>

            <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
                <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-base font-semibold">{name}</h3>

                    <BadgeCheck className="size-4 shrink-0 text-primary" />
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                    @{cleanUsername}
                </p>

                <p className="mt-1 line-clamp-2 h-10 text-sm leading-5 text-muted-foreground">
                    {description}
                </p>

                <div className="my-4 border-t border-[#333]" />

                <div className="flex items-center justify-between">
                    <p className="text-base font-semibold">
                        {price}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                            /min
                        </span>
                    </p>

                    <p
                        className={
                            isPositive
                                ? "text-sm font-medium text-green-500"
                                : "text-sm font-medium text-red-500"
                        }
                    >
                        {isPositive ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
                    </p>
                </div>

                <Button
                    className="mt-4 w-full"
                    onClick={() => router.push(`/creator/${cleanUsername}`)}
                >
                    Buy time
                </Button>
            </div>
        </Card>
    );
}