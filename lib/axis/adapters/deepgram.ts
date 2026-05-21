export type AxisDeepgramInput = {
  audioUrl?: string
  utterance?: string
}

export type AxisDeepgramOutput = {
  transcript: string
  basketballPhrases: string[]
}

export type AxisDeepgramAdapter = {
  available: boolean
  transcribe: (input: AxisDeepgramInput) => Promise<AxisDeepgramOutput>
}

export function createDeepgramAdapter(): AxisDeepgramAdapter {
  return {
    available: Boolean(process.env.DEEPGRAM_API_KEY),
    async transcribe(input) {
      return {
        transcript: input.utterance ?? "",
        basketballPhrases: input.utterance ? [input.utterance] : [],
      }
    },
  }
}
