import type { Metadata } from "next";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { formatRelativeTime } from "@/lib/format";
import { MarkReadButton } from "./mark-read-button";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Messages",
};

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  read: boolean;
  created_at: string;
};

export default async function AdminMessagesPage() {
  // contact_messages has zero RLS policies for authenticated/anon by design
  // (see its migration) -- this page is already gated on isAdmin by
  // admin/layout.tsx, so the service-role read here is safe.
  const admin = createServiceRoleClient();
  const { data: messages } = await admin
    .from("contact_messages")
    .select("id, name, email, message, read, created_at")
    .order("created_at", { ascending: false })
    .returns<ContactMessage[]>();

  return (
    <Container variant="dashboard">
      <BackLink href="/admin">Back to Admin</BackLink>
      <Heading>Messages</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Everything submitted through the /contact form. Reply directly to the sender&rsquo;s email — nothing
        here notifies them automatically.
      </p>

      <div className="mt-10 space-y-4">
        {(messages ?? []).length > 0 ? (
          (messages ?? []).map((m) => (
            <Card key={m.id} padding="md">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {m.name}
                    {!m.read ? (
                      <span className="ml-2 inline-flex items-center rounded-pill bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-sky-700 uppercase dark:bg-sky-400/10 dark:text-sky-300">
                        Unread
                      </span>
                    ) : null}
                  </p>
                  <a
                    href={`mailto:${m.email}`}
                    className="text-sm text-zinc-600 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-zinc-300 dark:decoration-white/30 dark:hover:decoration-white/70"
                  >
                    {m.email}
                  </a>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatRelativeTime(m.created_at)}</p>
              </div>
              <p className="mt-3 text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">{m.message}</p>
              <div className="mt-4">
                <MarkReadButton id={m.id} read={m.read} />
              </div>
            </Card>
          ))
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No messages yet.</p>
        )}
      </div>
    </Container>
  );
}
