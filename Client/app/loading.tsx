import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-5 py-10 text-white">
      <section className="grid w-full max-w-md gap-7">
        <div className="grid justify-items-center gap-4">
          <Skeleton className="h-12 w-64 bg-white/10" />
          <Skeleton className="h-5 w-52 bg-white/10" />
        </div>

        <div className="grid justify-items-center gap-3">
          <Skeleton className="size-28 rounded-full bg-white/10" />
          <Skeleton className="h-4 w-36 bg-white/10" />
        </div>

        <div className="grid gap-5">
          <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
          <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
          <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
        </div>
      </section>
    </main>
  );
}
