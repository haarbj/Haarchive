import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signOut } from "@/app/(app)/auth-actions";
import { getAppSession } from "@/lib/auth/session";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Access pending",
};

// Sibling of login/signup, deliberately outside (protected) -- it must stay
// reachable by an authenticated-but-unapproved user, which is exactly the
// state (protected)/layout.tsx redirects here for in the first place.
export default async function PendingPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");
  if (session.approved || session.isAdmin) redirect("/dashboard"); // stale bookmark, now approved

  return (
    <Container variant="auth">
      <Heading variant="compact">
        Not yet available
      </Heading>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        The Haarchive&rsquo;s coaching platform is currently limited to Brophy
        Prep coaches and Brophy Broncos athletes. If you think you should have
        access, reach out to your coach.
      </p>

      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
        >
          Sign out
        </button>
      </form>
    </Container>
  );
}
