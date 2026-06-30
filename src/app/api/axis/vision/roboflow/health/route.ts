import { NextResponse } from "next/server";
import { buildHealthPayload } from "../route";

export async function GET(request: Request) {
  return NextResponse.json(buildHealthPayload(request));
}
