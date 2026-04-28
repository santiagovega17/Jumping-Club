import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function UniversalJumpsLoading() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="rounded-2xl border border-violet-500/25 bg-zinc-900/70 px-5 py-4 md:px-6">
        <Skeleton className="h-6 w-52 bg-zinc-800" />
        <Skeleton className="mt-3 h-4 w-80 bg-zinc-800" />
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Card key={item} className="border border-zinc-800 bg-card/95">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-40 bg-zinc-800" />
              <Skeleton className="mt-3 h-8 w-20 bg-zinc-800" />
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card className="border border-zinc-800 bg-card/95 py-0">
        <CardHeader className="border-b border-zinc-800 py-4">
          <Skeleton className="h-5 w-52 bg-zinc-800" />
          <Skeleton className="mt-2 h-4 w-80 bg-zinc-800" />
        </CardHeader>
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-10 w-full bg-zinc-800" />
          ))}
        </div>
      </Card>
    </div>
  );
}
