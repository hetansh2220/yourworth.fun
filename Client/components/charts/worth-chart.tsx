"use client";

import { useId, useMemo, useState } from "react";
import type { CandleData, ChartTimeframe } from "@/data/chart-data";

interface WorthChartProps {
    data: CandleData[];
    compact?: boolean;
    showVolume?: boolean;
    referencePrice?: number;
    timeframe?: ChartTimeframe;
    onTimeframeChange?: (tf: ChartTimeframe) => void;
    showTimeframeSelector?: boolean;
    className?: string;
}

export function WorthChart({
    data,
    compact = false,
    showVolume = !compact,
    referencePrice,
    timeframe = "1D",
    onTimeframeChange,
    showTimeframeSelector = false,
    className = "",
}: WorthChartProps) {
    const id = useId();
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    const width = 600;
    const height = compact ? 150 : 250;
    const chartRightMargin = compact ? 50 : 60;
    const chartWidth = width - chartRightMargin;

    const timeframes: ChartTimeframe[] = ["1D", "1W", "1M", "1Y"];

    const { minPrice, maxPrice, maxVolume, priceRange } = useMemo(() => {
        if (!data || data.length === 0) {
            return { minPrice: 0, maxPrice: 10, maxVolume: 100, priceRange: 10 };
        }
        let min = data[0].low;
        let max = data[0].high;
        let maxVol = data[0].volume;

        for (const c of data) {
            if (c.low < min) min = c.low;
            if (c.high > max) max = c.high;
            if (c.volume > maxVol) maxVol = c.volume;
        }

        const padding = (max - min) * 0.14 || 1;
        const paddedMin = Math.max(0, min - padding);
        const paddedMax = max + padding;

        return {
            minPrice: paddedMin,
            maxPrice: paddedMax,
            maxVolume: maxVol || 1,
            priceRange: paddedMax - paddedMin || 1,
        };
    }, [data]);

    const chartTop = compact ? 12 : 20;
    const chartBottom = compact ? height - 18 : height - 26;
    const volumeHeight = showVolume ? (compact ? 24 : 45) : 0;
    const priceChartBottom = chartBottom - volumeHeight - (showVolume ? 8 : 0);
    const priceChartHeight = priceChartBottom - chartTop;

    const candleCount = data.length || 1;
    const slotWidth = chartWidth / candleCount;
    const candleWidth = Math.max(3, Math.min(compact ? 7 : 11, slotWidth * 0.65));

    const getY = (price: number) => {
        const normalized = (price - minPrice) / priceRange;
        return priceChartBottom - normalized * priceChartHeight;
    };

    const activeCandle = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : null;

    const latestPrice = referencePrice ?? (data.length > 0 ? data[data.length - 1].close : undefined);
    const refY = latestPrice !== undefined ? getY(latestPrice) : null;

    const gridLevels = compact ? [0.25, 0.75] : [0.2, 0.5, 0.8];

    const labelIndices = useMemo(() => {
        if (candleCount <= 4) return data.map((_, i) => i);
        return [
            0,
            Math.floor(candleCount * 0.25),
            Math.floor(candleCount * 0.5),
            Math.floor(candleCount * 0.75),
            candleCount - 1,
        ];
    }, [candleCount, data]);

    return (
        <div className={`relative flex flex-col w-full ${className}`}>
            {showTimeframeSelector && (
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center rounded-xl border border-[#24262B] bg-[#151518] p-1">
                        {timeframes.map((tf) => (
                            <button
                                key={tf}
                                type="button"
                                onClick={() => onTimeframeChange?.(tf)}
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                    timeframe === tf
                                        ? "bg-[#24262B] text-[#F5F7FA]"
                                        : "text-[#8B9099] hover:text-[#F5F7FA]"
                                }`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {activeCandle && !compact && (
                <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-[#8B9099]">
                    <span className="text-[#F5F7FA] font-medium">{activeCandle.timeLabel}</span>
                    <span>
                        O: <span className="text-[#F5F7FA]">${activeCandle.open.toFixed(2)}</span>
                    </span>
                    <span>
                        H: <span className="text-[#F5F7FA]">${activeCandle.high.toFixed(2)}</span>
                    </span>
                    <span>
                        L: <span className="text-[#F5F7FA]">${activeCandle.low.toFixed(2)}</span>
                    </span>
                    <span>
                        C:{" "}
                        <span
                            className={
                                activeCandle.close >= activeCandle.open
                                    ? "text-[#22C55E] font-medium"
                                    : "text-[#EF4444] font-medium"
                            }
                        >
                            ${activeCandle.close.toFixed(2)}
                        </span>
                    </span>
                    {showVolume && (
                        <span>
                            Vol: <span className="text-[#F5F7FA]">{activeCandle.volume.toLocaleString()}</span>
                        </span>
                    )}
                </div>
            )}

            <div className="relative w-full overflow-hidden select-none">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-auto overflow-visible block"
                    onMouseLeave={() => setHoverIndex(null)}
                    onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clientX = e.clientX - rect.left;
                        const svgX = (clientX / rect.width) * width;
                        const index = Math.floor((svgX / chartWidth) * candleCount);
                        if (index >= 0 && index < candleCount) {
                            setHoverIndex(index);
                        } else {
                            setHoverIndex(null);
                        }
                    }}
                >
                    <defs>
                        <linearGradient id={`volGreen-${id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22C55E" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#22C55E" stopOpacity="0.1" />
                        </linearGradient>
                        <linearGradient id={`volRed-${id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.1" />
                        </linearGradient>
                    </defs>

                    {gridLevels.map((lvl, idx) => {
                        const y = chartTop + lvl * priceChartHeight;
                        return (
                            <line
                                key={idx}
                                x1={0}
                                y1={y}
                                x2={chartWidth}
                                y2={y}
                                stroke="#24262B"
                                strokeDasharray="3 3"
                                strokeWidth="1"
                            />
                        );
                    })}

                    {showVolume &&
                        data.map((candle, idx) => {
                            const x = idx * slotWidth + slotWidth / 2;
                            const isBullish = candle.close >= candle.open;
                            const normVol = candle.volume / maxVolume;
                            const barH = Math.max(2, normVol * volumeHeight);
                            const barY = chartBottom - barH;

                            return (
                                <rect
                                    key={`vol-${idx}`}
                                    x={x - candleWidth / 2}
                                    y={barY}
                                    width={candleWidth}
                                    height={barH}
                                    rx="1"
                                    fill={isBullish ? `url(#volGreen-${id})` : `url(#volRed-${id})`}
                                />
                            );
                        })}

                    {data.map((candle, idx) => {
                        const x = idx * slotWidth + slotWidth / 2;
                        const isBullish = candle.close >= candle.open;
                        const color = isBullish ? "#22C55E" : "#EF4444";

                        const openY = getY(candle.open);
                        const closeY = getY(candle.close);
                        const highY = getY(candle.high);
                        const lowY = getY(candle.low);

                        const bodyTop = Math.min(openY, closeY);
                        const bodyHeight = Math.max(2, Math.abs(openY - closeY));

                        return (
                            <g key={`candle-${idx}`}>
                                <line
                                    x1={x}
                                    y1={highY}
                                    x2={x}
                                    y2={lowY}
                                    stroke={color}
                                    strokeWidth="1.2"
                                />
                                <rect
                                    x={x - candleWidth / 2}
                                    y={bodyTop}
                                    width={candleWidth}
                                    height={bodyHeight}
                                    rx="1"
                                    fill={color}
                                />
                            </g>
                        );
                    })}

                    {refY !== null && refY >= chartTop && refY <= priceChartBottom && (
                        <g>
                            <line
                                x1={0}
                                y1={refY}
                                x2={chartWidth + 6}
                                y2={refY}
                                stroke="#79AFFF"
                                strokeWidth="1.5"
                                strokeDasharray="4 3"
                                strokeOpacity="0.95"
                            />
                            <rect
                                x={width - chartRightMargin + 5}
                                y={refY - 9}
                                width={chartRightMargin - 7}
                                height={18}
                                rx="4"
                                fill="#79AFFF"
                            />
                            <text
                                x={width - (chartRightMargin - 7) / 2 - 2}
                                y={refY + 3.5}
                                fill="#050505"
                                fontSize="10"
                                fontWeight="700"
                                textAnchor="middle"
                            >
                                ${latestPrice?.toFixed(2)}
                            </text>
                        </g>
                    )}

                    {hoverIndex !== null && data[hoverIndex] && (
                        <g pointerEvents="none">
                            <line
                                x1={hoverIndex * slotWidth + slotWidth / 2}
                                y1={chartTop}
                                x2={hoverIndex * slotWidth + slotWidth / 2}
                                y2={chartBottom}
                                stroke="#79AFFF"
                                strokeWidth="1"
                                strokeDasharray="3 3"
                                strokeOpacity="0.7"
                            />
                        </g>
                    )}

                    {labelIndices.map((idx) => {
                        const candle = data[idx];
                        if (!candle) return null;
                        const x = idx * slotWidth + slotWidth / 2;
                        return (
                            <text
                                key={`label-${idx}`}
                                x={x}
                                y={height - 4}
                                fill="#555A63"
                                fontSize="9"
                                textAnchor={idx === 0 ? "start" : idx === candleCount - 1 ? "end" : "middle"}
                            >
                                {candle.timeLabel}
                            </text>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}
