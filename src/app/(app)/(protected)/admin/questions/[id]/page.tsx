import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { loadAllUsers } from "@/lib/admin/users";
import { mapQuestionRow } from "@/lib/questions/map-row";
import { QuestionTriagePanel } from "@/app/(app)/(protected)/admin/questions/[id]/question-triage-panel";
import { BackLink } from "@/components/ui/back-link";
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
      <BackLink href="/admin/questions">Back to Questions Admin</BackLink>
      <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{question.title}</h1>

      <QuestionTriagePanel question={question} users={users} />
    </Container>
  );
}
