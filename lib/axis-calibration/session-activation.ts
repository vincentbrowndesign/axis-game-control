export type SessionActivationStatus =
  | "in_session"
  | "step_into_frame"
  | "move_around"
  | "ready"
  | "training_active"

export type SessionIdentityHandshake = {
  method: "signed_in" | "wristband"
  playerId: string
}

export type SessionActivation = {
  handshake: SessionIdentityHandshake
  id: string
  organizationSlug: string
  sessionStartedAt: string
  status: SessionActivationStatus
}

type CreateSessionActivationInput = {
  organizationSlug: string
  playerId: string
  sessionStartedAt: string
}

export function createSessionActivation({
  organizationSlug,
  playerId,
  sessionStartedAt,
}: CreateSessionActivationInput): SessionActivation {
  return {
    handshake: {
      method: "signed_in",
      playerId,
    },
    id: createActivationId(),
    organizationSlug,
    sessionStartedAt,
    status: "in_session",
  }
}

function createActivationId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `activation-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
