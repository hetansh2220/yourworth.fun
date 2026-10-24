"use client";

import { useEffect, useRef, useState } from "react";

export function ProfileTradingChart({ symbol = "COINBASE:BTCUSD" }: { symbol?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Give each mount its own host so delayed scripts cannot reuse a stale widget.
    const host = document.createElement("div");
    host.className = "tradingview-widget-container h-full w-full";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget h-full w-full";
    host.appendChild(widget);
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.textContent = JSON.stringify({
      autosize: true,
      symbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      allow_symbol_change: false,
      hide_side_toolbar: true,
      hide_top_toolbar: true,
      hide_legend: false,
      hide_volume: false,
      backgroundColor: getComputedStyle(container).backgroundColor,
      gridColor: "rgba(255, 255, 255, 0.05)",
      calendar: false,
      details: false,
      withdateranges: false,
      support_host: "https://www.tradingview.com",
    });
    script.onerror = () => setFailed(true);
    host.appendChild(script);
    container.appendChild(host);

    return () => {
      script.onerror = null;
      host.remove();
    };
  }, [symbol]);

  return (
    <section aria-label="Market chart" className="overflow-hidden rounded-xl">
      <div ref={containerRef} className="h-[420px] w-full bg-background sm:h-[560px]" />
      {failed && <p role="status" className="px-4 py-2 text-sm text-muted-foreground">The chart could not load. Refresh the page to try again.</p>}
    </section>
  );
}
