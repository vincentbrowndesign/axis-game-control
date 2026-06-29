import { NextResponse } from "next/server";
import {
  defaultOverlayCalibration,
  defaultOverlaySettings,
  defaultOverlayTransform,
  type BasketballOverlayCalibration,
  type BasketballOverlayMode,
  type BasketballOverlaySettings,
  type BasketballOverlayTransform,
} from "@/lib/basketball";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

const overlayModes = new Set<BasketballOverlayMode>([
  "court-zones",
  "delta-offense",
  "shot-chart",
  "spacing-shapes",
]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    sessionId?: string;
    overlayType?: BasketballOverlayMode;
    opacity?: number;
    visible?: boolean;
    transform?: Partial<BasketballOverlayTransform>;
    calibration?: Partial<BasketballOverlayCalibration>;
    settings?: Partial<BasketballOverlaySettings>;
  } | null;

  if (!body?.userId || !body.sessionId || !body.overlayType || !overlayModes.has(body.overlayType)) {
    return NextResponse.json({ error: "OVERLAY_INPUT_INVALID" }, { status: 400 });
  }

  const opacity = typeof body.opacity === "number" ? Math.min(Math.max(body.opacity, 0.15), 1) : 0.65;
  const visible = body.visible ?? true;
  const transform: BasketballOverlayTransform = {
    ...defaultOverlayTransform,
    ...body.transform,
    visible,
  };
  const calibration: BasketballOverlayCalibration = {
    ...defaultOverlayCalibration,
    ...body.calibration,
    cornerPins: {
      ...defaultOverlayCalibration.cornerPins,
      ...body.calibration?.cornerPins,
    },
  };
  const settings: BasketballOverlaySettings = {
    ...defaultOverlaySettings,
    ...body.settings,
  };
  const supabase = createServiceSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("basketball_overlay_configs")
      .insert({
        user_id: body.userId,
        session_id: body.sessionId,
        overlay_type: body.overlayType,
        opacity,
        transform,
        settings,
        calibration,
        is_active: true,
      })
      .select("id,user_id,session_id,overlay_type,opacity,transform,calibration,settings")
      .single();

    if (!error && data) {
      return NextResponse.json({
        overlay: {
          id: data.id,
          userId: data.user_id,
          sessionId: data.session_id,
          overlayType: data.overlay_type,
          opacity: data.opacity,
          visible: Boolean(data.transform?.visible ?? true),
          transform: data.transform,
          calibration: data.calibration,
          settings: data.settings,
          persisted: true,
        },
      });
    }
  }

  return NextResponse.json({
    overlay: {
      id: crypto.randomUUID(),
      userId: body.userId,
      sessionId: body.sessionId,
      overlayType: body.overlayType,
      opacity,
      visible,
      transform,
      calibration,
      settings,
      persisted: false,
    },
  });
}
