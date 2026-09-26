export type CandleData = {
    timestamp: number;
    timeLabel: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
};

export type ChartTimeframe = "1D" | "1W" | "1M" | "1Y";

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function pseudoRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}

export function getMockHistoricalData(
    identifier: string,
    timeframe: ChartTimeframe,
    targetPrice = 25.0,
    targetChangePercent = 0
): CandleData[] {
    const seed = hashString(`${identifier}_${timeframe}`);
    const rand = pseudoRandom(seed);

    let count = 28;
    let stepMs = 30 * 60 * 1000;
    if (timeframe === "1W") {
        count = 28;
        stepMs = 6 * 60 * 60 * 1000;
    } else if (timeframe === "1M") {
        count = 30;
        stepMs = 24 * 60 * 60 * 1000;
    } else if (timeframe === "1Y") {
        count = 36;
        stepMs = 10 * 24 * 60 * 60 * 1000;
    }

    const now = Date.now();
    const startTime = now - count * stepMs;
    const baseValue = targetPrice <= 0 ? 12.5 : targetPrice;
    const changeFactor = targetChangePercent / 100;
    const startPrice = baseValue / (1 + changeFactor || 1);

    const candles: CandleData[] = [];
    let currentOpen = startPrice;

    for (let i = 0; i < count; i++) {
        const time = startTime + i * stepMs;
        const progress = (i + 1) / count;
        const trend = startPrice + (baseValue - startPrice) * progress;

        const noise = (rand() - 0.48) * (baseValue * 0.05);
        let close = (i === count - 1 && targetPrice > 0) ? targetPrice : trend + noise;
        if (close < 0.1) close = 0.1;

        const open = i === 0 ? currentOpen : candles[i - 1].close;
        const high = Math.max(open, close) + rand() * (baseValue * 0.025);
        const low = Math.max(0.05, Math.min(open, close) - rand() * (baseValue * 0.025));
        const volume = Math.floor(100 + rand() * 900 + (Math.abs(close - open) / baseValue) * 3000);

        let timeLabel = "";
        const d = new Date(time);
        if (timeframe === "1D") {
            timeLabel = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
        } else if (timeframe === "1W") {
            timeLabel = d.toLocaleDateString([], { weekday: "short" });
        } else if (timeframe === "1M") {
            timeLabel = d.toLocaleDateString([], { month: "short", day: "numeric" });
        } else {
            timeLabel = d.toLocaleDateString([], { month: "short" });
        }

        candles.push({
            timestamp: time,
            timeLabel,
            open: Number(open.toFixed(2)),
            high: Number(high.toFixed(2)),
            low: Number(low.toFixed(2)),
            close: Number(close.toFixed(2)),
            volume,
        });

        currentOpen = close;
    }

    return candles;
}
