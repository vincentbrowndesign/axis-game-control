import type {
  CameraOrientation,
  DigitalTwin,
  DigitalTwinRole,
  DominantHand,
} from "./types"

const TWIN_KEY = "axis-digital-twin-v1"
const LOCAL_TWIN_NAME = "LOCAL PLAYER"

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage)
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function normalizeDisplayName(value?: string | null) {
  const name = value?.trim()

  if (!name || name === "Unassigned") return LOCAL_TWIN_NAME

  return name
}

function normalizeRole(value?: string | null): DigitalTwinRole {
  if (value === "trainer" || value === "coach") return value

  return "player"
}

function normalizeHand(value?: string | null): DominantHand {
  if (value === "left" || value === "both") return value

  return "right"
}

function normalizeCamera(value?: string | null): CameraOrientation {
  return value === "front" ? "front" : "rear"
}

function localTwin(displayName = LOCAL_TWIN_NAME): DigitalTwin {
  const now = Date.now()
  const normalized = normalizeDisplayName(displayName)

  return {
    id:
      normalized === LOCAL_TWIN_NAME
        ? "local-player"
        : `twin-${slug(normalized) || "local-player"}`,
    displayName: normalized,
    dominantHand: "right",
    role: "player",
    cameraOrientation: "rear",
    createdAt: now,
    updatedAt: now,
  }
}

export function getActiveTwin(
  fallbackName?: string | null
): DigitalTwin {
  if (!canUseStorage()) return localTwin(fallbackName || LOCAL_TWIN_NAME)

  const existing = safeParse<DigitalTwin>(
    window.localStorage.getItem(TWIN_KEY)
  )

  if (existing?.id && existing.displayName) return existing

  return getOrCreateLocalTwin(fallbackName)
}

export function getOrCreateLocalTwin(
  fallbackName?: string | null
): DigitalTwin {
  const twin = localTwin(fallbackName || LOCAL_TWIN_NAME)

  if (canUseStorage()) {
    window.localStorage.setItem(TWIN_KEY, JSON.stringify(twin))
  }

  return twin
}

export function saveLocalTwin(input: {
  displayName: string
  dominantHand: string
  role: string
  cameraOrientation: string
  photo?: string | null
  grade?: string | null
  position?: string | null
}): DigitalTwin {
  const existing = canUseStorage()
    ? safeParse<DigitalTwin>(window.localStorage.getItem(TWIN_KEY))
    : null
  const now = Date.now()
  const displayName = normalizeDisplayName(input.displayName)
  const twin: DigitalTwin = {
    id: existing?.id || `twin-${slug(displayName) || "local-player"}`,
    displayName,
    dominantHand: normalizeHand(input.dominantHand),
    role: normalizeRole(input.role),
    cameraOrientation: normalizeCamera(input.cameraOrientation),
    photo: input.photo || existing?.photo || null,
    grade: input.grade || existing?.grade || null,
    position: input.position || existing?.position || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }

  if (canUseStorage()) {
    window.localStorage.setItem(TWIN_KEY, JSON.stringify(twin))
  }

  return twin
}
