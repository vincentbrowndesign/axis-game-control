"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import styles from "@/app/page.module.css"

type TrainCheckInButtonProps = {
  checkedInAt: string | null
  organizationSlug: string
}

type CheckInResponse = {
  checkIn?: {
    checked_in_at?: string
  }
  error?: string
  ok?: boolean
}

export function TrainCheckInButton({
  checkedInAt,
  organizationSlug,
}: TrainCheckInButtonProps) {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)
  const [savedAt, setSavedAt] = useState(checkedInAt)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  async function handleCheckIn() {
    if (savedAt || isChecking || isPending) return

    setError("")
    setIsChecking(true)

    try {
      const response = await fetch(`/api/org/${organizationSlug}/check-in`, {
        method: "POST",
      })
      const payload = (await response.json()) as CheckInResponse

      if (!response.ok || !payload.ok || !payload.checkIn?.checked_in_at) {
        setError("Check-in could not be saved. Try again.")
        return
      }

      setSavedAt(payload.checkIn.checked_in_at)
      startTransition(() => router.refresh())
    } catch {
      setError("Check-in could not be saved. Try again.")
    } finally {
      setIsChecking(false)
    }
  }

  const label = savedAt
    ? `CHECKED IN - ${formatCheckInTime(savedAt)}`
    : isChecking || isPending
      ? "CHECKING IN"
      : "CHECK IN"

  return (
    <div className={styles.trainCheckInControl}>
      <button
        className={styles.trainCheckInButton}
        disabled={Boolean(savedAt) || isChecking || isPending}
        onClick={handleCheckIn}
        type="button"
      >
        {label}
      </button>
      {error ? <p className={styles.trainCheckInError}>{error}</p> : null}
    </div>
  )
}

function formatCheckInTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}
