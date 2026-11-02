import { Skeleton } from "@/components/ui/skeleton";

export function ChatThreadSkeleton() {
  const messages = [
    ["start", "w-44"],
    ["end", "w-56"],
    ["start", "w-32"],
    ["end", "w-48"],
    ["start", "w-52"],
    ["end", "w-36"],
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/5 bg-card/60 px-4">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="ml-auto h-9 w-20 rounded-full" />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-5">
        {messages.map(([side, width], index) => (
          <div key={index} className={`flex items-end gap-3 ${side === "end" ? "justify-end" : "justify-start"}`}>
            {side === "start" && <Skeleton className="size-10 rounded-full" />}
            <Skeleton className={`h-10 ${width} rounded-2xl`} />
            {side === "end" && <Skeleton className="size-10 rounded-full" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChatMessagesSkeleton() {
  const messages = ["w-44", "w-56", "w-32", "w-48", "w-52", "w-36"];

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden p-5">
      {messages.map((width, index) => (
        <div
          key={index}
          className={`flex items-end gap-3 ${index % 2 ? "justify-end" : "justify-start"}`}
        >
          {index % 2 === 0 && <Skeleton className="size-10 rounded-full" />}
          <Skeleton className={`h-10 ${width} rounded-2xl`} />
          {index % 2 === 1 && <Skeleton className="size-10 rounded-full" />}
        </div>
      ))}
    </div>
  );
}
