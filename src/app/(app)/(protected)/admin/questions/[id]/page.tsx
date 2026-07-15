import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { loadAllUsers } from "@/lib/admin/users";
import { mapQuestionRow } from "@/lib/questions/map-row";
import { QuestionTriagePanel } from "@/app/(app)/(protected)/admin/questions/[id]/question-triage-panel";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Triage Question" };
export const dynamic = "force-dynamic";

type AdminQuestionDetailProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminQuestionDetailPage({ params }: AdminQuestionDetailProps) {
  const { id } = await params;

  const admin = createServiceRoleClient();
  const [{ data }, users] = await Promise.all([
    admin.from("questions").select("*").eq("id", id).maybeSingle(),
    loadAllUsers(),
  ]);
  if (!data) notFound();

  const question = mapQuestionRow(data);

  return (
    <Container variant="dashboard">
      <Link
        href="/admin/questions"
        className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
      >
        <span aria-hidden="true">←</span> Back to Questions Admin
      </Link>
      <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{question.title}</h1>

      <QuestionTriagePanel question={question} users={users} />
    </Container>
  );
}
