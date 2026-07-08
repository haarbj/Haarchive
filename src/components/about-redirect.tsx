"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function AboutRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16 animate-fade-in">
      <p className="text-zinc-600 dark:text-zinc-300">
        This page has moved.{" "}
        <Link
          href="/"
          className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
        >
          Continue to the homepage →
        </Link>
      </p>
    </section>
  );
}
