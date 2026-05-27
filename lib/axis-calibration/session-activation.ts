export type SessionActivationStatus =
  | "checked_in"
  | "step_into_frame"
  | "move_around"
  | "ready"
  | "training_active"

export type SessionIdentityHandshake = {
  method: "signed_in" | "wristband"
  playerId: string
}

export type SessionActivation = {
  checkedInAt: string
  handshake: SessionIdentityHandshake
  id: string
  organizationSlug: string
  status: SessionActivationStatus
}

type CreateSessionActivationInput = {
  checkedInAt: string
  organizationSlug: string
  playerId: string
}

export function createSessionActivation({
  checkedInAt,
  organizationSlug,
  playerId,
}: CreateSessionActivationInput): SessionActivation {
  return {
    checkedInAt,
    handshake: {
      method: "signed_in",
      playerId,
    },
    id: createActivationId(),
    organizationSlug,
    status: "checked_in",
  }
}

function createActivationId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `activation-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
