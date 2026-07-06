import { asStringArray, asTrimmedString } from "../../../../../../lib/axis-event-container";
import { getAxisContainerClient } from "../../../../../../lib/axis-event-container-server";

export const runtime = "nodejs";

function readReportFields(body: Record<string, unknown>) {
  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = asTrimmedString(body.title);
  if (body.summary !== undefined) update.summary = asTrimmedString(body.summary);
  if (body.next_focus !== undefined) update.next_focus = asTrimmedString(body.next_focus);
  if (body.strengths !== undefined) update.strengths = asStringArray(body.strengths) ?? [];
  if (body.corrections !== undefined) update.corrections = asStringArray(body.corrections) ?? [];
  if (body.status === "draft" || body.status === "ready") update.status = body.status;
  if (Array.isArray(body.evidence)) {
    update.evidence = body.evidence
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({ moment_id: String(item.moment_id ?? "") }))
      .filter((item) => item.moment_id);
  }
  return update;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = getAxisContainerClient();
  if (!client.ok) return Response.json({ code: client.code, error: client.reason }, { status: 503 });

  const { id } = await context.params;
  const eventId = id.trim();
  if (!eventId) return Response.json({ error: "event id is required" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "invalid JSON body" }, { status: 400 });

  const fields = readReportFields(body);
  const reportId = asTrimmedString(body.report_id);

  if (reportId) {
    const { data, error } = await client.supabase
      .from("axis_reports")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", reportId)
      .eq("event_id", eventId)
      .select()
      .single();
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ report: data });
  }

  const { data, error } = await client.supabase
    .from("axis_reports")
    .insert({ ...fields, event_id: eventId, report_type: "summary" })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({ report: data }, { status: 201 });
}
