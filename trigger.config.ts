import { defineConfig } from "@trigger.dev/sdk"

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF || "axis-game-control",
  dirs: ["./trigger"],
  maxDuration: 120,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 1,
    },
  },
})
