import { NextResponse } from "next/server"

import { validateEnvironment } from "@/lib/vision/environmentValidation"
import { buildSequence } from "@/lib/vision/sequenceEngine"

export async function POST() {
  const environment = await validateEnvironment()

  const sequence = await buildSequence()

  return NextResponse.json({
    environment,
    sequence
  })
}