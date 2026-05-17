export type SessionTranscriptionResult = {
  text: string
  model: string
  usedMock: boolean
}

export async function transcribeSession(input: {
  file?: File | Blob
  fallbackText?: string | null
}): Promise<SessionTranscriptionResult> {
  const fallbackText = input.fallbackText?.trim()

  if (fallbackText) {
    return {
      text: fallbackText,
      model: "browser-speech",
      usedMock: false,
    }
  }

  if (!process.env.OPENAI_API_KEY || !input.file) {
    return {
      text: "",
      model: "mock-transcription",
      usedMock: true,
    }
  }

  const { default: OpenAI } = await import("openai")
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  const transcript = await client.audio.transcriptions.create({
    file: input.file as File,
    model: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1",
  })

  return {
    text: transcript.text || "",
    model: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1",
    usedMock: false,
  }
}
