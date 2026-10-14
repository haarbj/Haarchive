import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { TemplateForm } from "../template-form";
import type { ExtraPresetOption } from "../../athletes/[athleteId]/schedule/actions";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "New Template",
  robots: { index: false, follow: false },
};

type ExtraPresetRow = {
  id: string;
  name: string;
  kind: string;
  overview: string | null;
  count: number | null;
  distance_m: number | null;
  duration_s: number | null;
  items: string[] | null;
};

export default async function NewTemplatePage() {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");

  // Same coach-global library ExtrasEditor already reads from in the
  // schedule forms (see schedule/page.tsx's identical query) -- not
  // scoped to any one athlete or template.
  const supabase = await createClient();
  const { data: extraPresetRows } = await supabase
    .from("coach_extra_presets")
    .select("id, name, kind, overview, count, distance_m, duration_s, items")
    .eq("coach_id", session.userId)
    .order("name")
    .returns<ExtraPresetRow[]>();
  const extraPresets: ExtraPresetOption[] = (extraPresetRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    overview: p.overview,
    count: p.count,
    distanceM: p.distance_m,
    durationS: p.duration_s,
    items: p.items ?? [],
  }));

  return (
    <Container variant="content">
      <BackLink href="/coaching/templates">Templates</BackLink>
      <Heading>New Template</Heading>
      <div className="mt-8">
        <TemplateForm extraPresets={extraPresets} />
      </div>
    </Container>
  );
}
