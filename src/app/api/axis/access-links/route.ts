import {
  AXIS_ACCESS_LEVELS,
  AXIS_ACCESS_TARGET_TYPES,
  asTrimmedString,
  isOneOf,
} from "../../../../lib/axis-event-container";
import { getAxisContainerClient } from "../../../../lib/axis-event-container-server";

export const runtime = "nodejs";

export async function GET() {
  const client = getAxisContainerClient();
  if (!client.ok) return Response.json({ code: client.code, error: client.reason }, { status: 503 });

  const { data, error } = await client.supabase
    .from("axis_access_links")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({ accessLinks: data ?? [] });
}

export async function POST(request: Request) {
  const client = getAxisContainerClient();
  if (!client.ok) return Response.json({ code: client.code, error: client.reason }, { status: 503 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "invalid JSON body" }, { status: 400 });

  const label = asTrimmedString(body.label);
  const url = asTrimmedString(body.url);
  if (!label) return Response.json({ error: "label is required" }, { status: 400 });
  if (!url) return Response.json({ error: "url is required" }, { status: 400 });
  const targetType = isOneOf(body.target_type, AXIS_ACCESS_TARGET_TYPES) ? body.target_type : "event";
  const accessLevel = isOneOf(body.access_level, AXIS_ACCESS_LEVELS) ? body.access_level : "paid";
  const priceCents =
    typeof body.price_cents === "number" && Number.isFinite(body.price_cents) && body.price_cents >= 0
      ? Math.round(body.price_cents)
      : null;

  const { data, error } = await client.supabase
    .from("axis_access_links")
    .insert({
      access_level: accessLevel,
      event_id: asTrimmedString(body.event_id),
      label,
      price_cents: priceCents,
      report_id: asTrimmedString(body.report_id),
      target_type: targetType,
      url,
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({ accessLink: data }, { status: 201 });
}
