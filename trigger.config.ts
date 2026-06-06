import { ffmpeg } from "@trigger.dev/build/extensions/core"
import { defineConfig } from "@trigger.dev/sdk"

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF || "axis-game-control",
  dirs: ["./trigger"],
  maxDuration: 120,
  build: {
    extensions: [
      ffmpeg(),
    ],
  },
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 1,
    },
  },
})
