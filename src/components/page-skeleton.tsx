// Every coach/athlete page here is a server component doing 2-4 sequential
// Supabase queries with no client-side loading state of its own -- without
// this, the tab just goes blank until the RSC resolves. Shaped to match the
// common page shell (max-w-3xl, py-16, h1 + paragraph + a couple of cards)
// so real content doesn't visibly jump when it replaces the skeleton.
export function PageSkeleton() {
  return (
    <section className="mx-auto w-full max-w-3xl animate-pulse px-6 py-16">
      <div className="h-10 w-2/3 rounded-lg bg-black/10 dark:bg-white/10" />
      <div className="mt-6 h-5 w-full max-w-md rounded bg-black/5 dark:bg-white/10" />
      <div className="mt-10 space-y-3">
        <div className="h-20 rounded-2xl bg-black/5 dark:bg-white/5" />
        <div className="h-20 rounded-2xl bg-black/5 dark:bg-white/5" />
        <div className="h-20 rounded-2xl bg-black/5 dark:bg-white/5" />
      </div>
    </section>
  );
}
