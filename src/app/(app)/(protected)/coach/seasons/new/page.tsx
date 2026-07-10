import type { Metadata } from "next";

import { CreateSeasonFlow } from "./create-season-flow";

export const metadata: Metadata = {
  title: "Generate a Season",
};

export default function NewSeasonPage() {
  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-16 animate-fade-in">
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
        Generate a season
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Set it up, preview exactly what will be created, then create it.
      </p>

      <div className="mt-10">
        <CreateSeasonFlow />
      </div>
    </section>
  );
}
