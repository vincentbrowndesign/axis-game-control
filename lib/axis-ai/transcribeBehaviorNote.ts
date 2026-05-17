import { transcribeSession } from "@/lib/axis-ai/transcribeSession"

export type BehaviorNoteTranscript = {
  text: string
  source: "typed" | "voice" | "empty"
  usedMock: boolean
}

export async function transcribeBehaviorNote(input?: {
  audioUrl?: string | null
  typedText?: string | null
}): Promise<BehaviorNoteTranscript> {
  const typedText = input?.typedText?.trim()

  if (typedText) {
    const result = await transcribeSession({
      fallbackText: typedText,
    })

    return {
      text: result.text,
      source: "typed",
      usedMock: result.usedMock,
    }
  }

  if (input?.audioUrl && process.env.OPENAI_API_KEY) {
    return {
      text: "",
      source: "voice",
      usedMock: true,
    }
  }

  return {
    text: "",
    source: "empty",
    usedMock: true,
  }
}
