import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-5 py-10 text-white">
      <section className="grid w-full max-w-md gap-7 text-center">
        <div className="grid justify-items-center gap-4">
          <Skeleton className="h-12 w-72 bg-white/10" />
          <Skeleton className="h-5 w-56 bg-white/10" />
        </div>

        <div className="grid gap-4">
          <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
          <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
        </div>
      </section>
    </main>
  );
}
