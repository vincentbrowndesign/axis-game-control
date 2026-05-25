"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import styles from "./AxisDaily.module.css"

type CheckInStatus = "idle" | "locating" | "saving" | "saved" | "denied"

type CheckInResponse = {
  denied?: boolean
  distanceMeters?: number
  error?: string
  ok?: boolean
}

export function CheckInForm() {
  const router = useRouter()
  const [status, setStatus] = useState<CheckInStatus>("idle")
  const [message, setMessage] = useState("")
  const [workoutType, setWorkoutType] = useState("Skill work")
  const [durationMinutes, setDurationMinutes] = useState("45")
  const [notes, setNotes] = useState("")

  async function submitCheckIn() {
    setStatus("locating")
    setMessage("Checking gym location...")

    try {
      const position = await readCurrentPosition()
      setStatus("saving")
      setMessage("Saving training day...")

      const response = await fetch("/api/check-in", {
        body: JSON.stringify({
          durationMinutes: Number(durationMinutes),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          notes,
          workoutType,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      })
      const data = (await response.json().catch(() => ({}))) as CheckInResponse

      if (!response.ok || !data.ok) {
        setStatus(data.denied ? "denied" : "idle")
        setMessage(data.error || "Check-in could not be saved.")
        return
      }

      setStatus("saved")
      setMessage("Checked in. Training memory saved.")
      router.refresh()
      router.push("/memory")
    } catch (error) {
      setStatus("idle")
      setMessage(
        error instanceof Error
          ? error.message
          : "Location was not available."
      )
    }
  }

  const busy = status === "locating" || status === "saving"

  return (
    <section className={styles.panel} aria-label="Training check-in">
      <div className={styles.form}>
        <label className={styles.label}>
          Workout
          <select
            className={styles.select}
            onChange={(event) => setWorkoutType(event.target.value)}
            value={workoutType}
          >
            <option>Skill work</option>
            <option>Shooting</option>
            <option>Strength</option>
            <option>Team practice</option>
            <option>Recovery</option>
          </select>
        </label>
        <label className={styles.label}>
          Minutes
          <input
            className={styles.input}
            inputMode="numeric"
            min="0"
            onChange={(event) => setDurationMinutes(event.target.value)}
            type="number"
            value={durationMinutes}
          />
        </label>
        <label className={styles.label}>
          Notes
          <textarea
            className={styles.textarea}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What happened today?"
            value={notes}
          />
        </label>
        <button
          className={styles.button}
          disabled={busy}
          onClick={submitCheckIn}
          type="button"
        >
          {busy ? "Checking..." : "Check in"}
        </button>
        <p
          className={`${styles.status} ${
            status === "denied" ? styles.statusDenied : ""
          }`}
        >
          {message}
        </p>
      </div>
    </section>
  )
}

function readCurrentPosition() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("Location is not available on this device."))
  }

  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 12000,
    })
  })
}
