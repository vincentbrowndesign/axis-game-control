import type { TemporalEventPayload } from "@/lib/temporalEventGraph"

type PassiveContinuityEvent = {
  type: string
  payload: TemporalEventPayload
}

type PassiveContinuityObserverOptions = {
  getSessionTime: () => number
  appendEvent: (event: PassiveContinuityEvent) => void
}

type PassiveContinuityObserverController = {
  stop: () => void
}

type BatteryManagerLike = EventTarget & {
  charging?: boolean
  level?: number
}

const motionEnergyThrottleMs = 8000
const tempoShiftThrottleMs = 12000
const deviceStateThrottleMs = 15000
const orientationThrottleMs = 5000
const motionEnergyThreshold = 16
const tempoShiftThreshold = 5

function now() {
  return Date.now()
}

function round(value: number, precision = 2) {
  const scale = 10 ** precision
  return Math.round(value * scale) / scale
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function orientationSnapshot() {
  if (typeof window === "undefined") return null
  const legacyWindow = window as Window & {
    orientation?: number
  }

  return {
    angle: window.screen.orientation?.angle ?? legacyWindow.orientation ?? 0,
    type: window.screen.orientation?.type ?? "unknown",
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function createPassivePayload(
  source: string,
  sessionTime: number,
  data: Record<string, unknown>
): TemporalEventPayload {
  return {
    source: "LOCAL_PASSIVE_OBSERVER",
    observer: source,
    session_time: round(sessionTime, 3),
    ...data,
  }
}

export function startPassiveContinuityObservers({
  getSessionTime,
  appendEvent,
}: PassiveContinuityObserverOptions): PassiveContinuityObserverController {
  if (typeof window === "undefined") {
    return {
      stop: () => undefined,
    }
  }

  const cleanup: Array<() => void> = []
  let stopped = false
  let lastMotionEnergyAt = 0
  let lastTempoShiftAt = 0
  let lastDeviceStateAt = 0
  let lastOrientationAt = 0
  let motionBaseline = 0
  let tempoBaseline = 0
  let motionSamples: number[] = []

  const emit = (type: string, observer: string, data: Record<string, unknown>) => {
    if (stopped) return

    appendEvent({
      type,
      payload: createPassivePayload(observer, getSessionTime(), data),
    })
  }

  const observeMotion = (event: DeviceMotionEvent) => {
    const acceleration = event.accelerationIncludingGravity || event.acceleration
    const x = safeNumber(acceleration?.x)
    const y = safeNumber(acceleration?.y)
    const z = safeNumber(acceleration?.z)
    const energy = Math.sqrt(x * x + y * y + z * z)

    if (!energy) return

    motionBaseline = motionBaseline ? motionBaseline * 0.86 + energy * 0.14 : energy
    motionSamples = [...motionSamples.slice(-9), energy]

    const timestamp = now()
    const energyDelta = Math.abs(energy - motionBaseline)

    if (energyDelta >= motionEnergyThreshold && timestamp - lastMotionEnergyAt > motionEnergyThrottleMs) {
      lastMotionEnergyAt = timestamp
      emit("MOTION_ENERGY", "motion_energy", {
        energy: round(energy),
        baseline: round(motionBaseline),
        delta: round(energyDelta),
      })
    }

    if (motionSamples.length < 6) return

    const average =
      motionSamples.reduce((total, sample) => total + sample, 0) / motionSamples.length
    tempoBaseline = tempoBaseline ? tempoBaseline * 0.92 + average * 0.08 : average
    const tempoDelta = Math.abs(average - tempoBaseline)

    if (tempoDelta >= tempoShiftThreshold && timestamp - lastTempoShiftAt > tempoShiftThrottleMs) {
      lastTempoShiftAt = timestamp
      emit("TEMPO_SHIFT", "tempo_shift", {
        averageMotion: round(average),
        baseline: round(tempoBaseline),
        delta: round(tempoDelta),
      })
    }
  }

  window.addEventListener("devicemotion", observeMotion, {
    passive: true,
  })
  cleanup.push(() => window.removeEventListener("devicemotion", observeMotion))

  const emitDeviceState = (reason: string, extra: Record<string, unknown> = {}) => {
    const timestamp = now()
    if (timestamp - lastDeviceStateAt < deviceStateThrottleMs && reason !== "observer_started") {
      return
    }

    lastDeviceStateAt = timestamp
    emit("DEVICE_STATE", "device_state", {
      reason,
      visibility: document.visibilityState,
      online: navigator.onLine,
      pixelRatio: window.devicePixelRatio,
      ...extra,
    })
  }

  const handleVisibility = () => emitDeviceState("visibility_change")
  const handleOnline = () => emitDeviceState("network_available")
  const handleOffline = () => emitDeviceState("network_hold")

  document.addEventListener("visibilitychange", handleVisibility)
  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)
  cleanup.push(() => {
    document.removeEventListener("visibilitychange", handleVisibility)
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
  })

  const emitOrientation = (reason: string) => {
    const timestamp = now()
    if (timestamp - lastOrientationAt < orientationThrottleMs) return

    const orientation = orientationSnapshot()
    if (!orientation) return

    lastOrientationAt = timestamp
    emit("ORIENTATION_CHANGE", "orientation_change", {
      reason,
      ...orientation,
    })
  }

  const handleOrientation = () => emitOrientation("orientation_change")
  const handleResize = () => emitOrientation("viewport_change")
  const screenOrientation = window.screen.orientation

  window.addEventListener("orientationchange", handleOrientation)
  window.addEventListener("resize", handleResize)
  screenOrientation?.addEventListener("change", handleOrientation)
  cleanup.push(() => {
    window.removeEventListener("orientationchange", handleOrientation)
    window.removeEventListener("resize", handleResize)
    screenOrientation?.removeEventListener("change", handleOrientation)
  })

  emitDeviceState("observer_started")
  emitOrientation("observer_started")

  const batteryProvider = navigator as Navigator & {
    getBattery?: () => Promise<BatteryManagerLike>
  }

  if (batteryProvider.getBattery) {
    batteryProvider
      .getBattery()
      .then((battery) => {
        if (stopped) return

        const emitBattery = () =>
          emitDeviceState("battery_change", {
            charging: Boolean(battery.charging),
            level:
              typeof battery.level === "number"
                ? Math.round(battery.level * 100)
                : null,
          })

        battery.addEventListener("chargingchange", emitBattery)
        battery.addEventListener("levelchange", emitBattery)
        cleanup.push(() => {
          battery.removeEventListener("chargingchange", emitBattery)
          battery.removeEventListener("levelchange", emitBattery)
        })
        emitBattery()
      })
      .catch(() => undefined)
  }

  return {
    stop: () => {
      stopped = true
      cleanup.splice(0).forEach((dispose) => dispose())
    },
  }
}
