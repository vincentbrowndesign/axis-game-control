import type { ReactNode } from "react"
import styles from "./AxisPrimitives.module.css"

type AxisTone = "default" | "active" | "live" | "warm"

type AxisSurfaceProps = {
  children: ReactNode
  className?: string
  tone?: AxisTone
}

type AxisHeroProps = {
  eyebrow?: string
  title: ReactNode
  children?: ReactNode
}

type AxisCardProps = {
  children: ReactNode
  className?: string
  tone?: AxisTone
}

type AxisSignalProps = {
  label: string
  value: ReactNode
  tone?: AxisTone
}

type AxisMetricProps = {
  label: string
  value: ReactNode
  detail?: ReactNode
}

type AxisCheckInStateProps = {
  label: ReactNode
  subtext?: ReactNode
  status?: "idle" | "saving" | "complete"
}

type AxisProgressNodeProps = {
  label: string
  state?: "idle" | "active" | "complete"
}

type AxisCalendarDay = {
  id: string
  label: string
  state?: "empty" | "complete" | "active"
}

type AxisCalendarProps = {
  days: AxisCalendarDay[]
  label?: string
}

type AxisLeaderboardItemProps = {
  label: string
  rank: number | string
  value: ReactNode
}

function toneClass(tone: AxisTone = "default") {
  if (tone === "active") return styles.toneActive
  if (tone === "live") return styles.toneLive
  if (tone === "warm") return styles.toneWarm

  return styles.toneDefault
}

export function AxisSurface({ children, className, tone }: AxisSurfaceProps) {
  return (
    <section className={`${styles.surface} ${toneClass(tone)} ${className || ""}`}>
      {children}
    </section>
  )
}

export function AxisHero({ eyebrow, title, children }: AxisHeroProps) {
  return (
    <div className={styles.hero}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h1 className={styles.heroTitle}>{title}</h1>
      {children ? <div className={styles.heroBody}>{children}</div> : null}
    </div>
  )
}

export function AxisCard({ children, className, tone }: AxisCardProps) {
  return (
    <div className={`${styles.card} ${toneClass(tone)} ${className || ""}`}>
      {children}
    </div>
  )
}

export function AxisSignal({ label, value, tone }: AxisSignalProps) {
  return (
    <div className={`${styles.signal} ${toneClass(tone)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function AxisMetric({ label, value, detail }: AxisMetricProps) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  )
}

export function AxisCheckInState({
  label,
  status = "idle",
  subtext,
}: AxisCheckInStateProps) {
  return (
    <div className={`${styles.checkInState} ${styles[`state${status}`]}`}>
      <strong>{label}</strong>
      {subtext ? <span>{subtext}</span> : null}
    </div>
  )
}

export function AxisProgressNode({
  label,
  state = "idle",
}: AxisProgressNodeProps) {
  return (
    <div className={`${styles.progressNode} ${styles[`node${state}`]}`}>
      <span aria-hidden="true" />
      <strong>{label}</strong>
    </div>
  )
}

export function AxisCalendar({ days, label = "Axis history" }: AxisCalendarProps) {
  return (
    <div className={styles.calendar} aria-label={label}>
      {days.map((day) => (
        <div
          className={`${styles.calendarDay} ${styles[`day${day.state || "empty"}`]}`}
          key={day.id}
        >
          <span>{day.label}</span>
        </div>
      ))}
    </div>
  )
}

export function AxisLeaderboardItem({
  label,
  rank,
  value,
}: AxisLeaderboardItemProps) {
  return (
    <div className={styles.leaderboardItem}>
      <span>{rank}</span>
      <strong>{label}</strong>
      <em>{value}</em>
    </div>
  )
}

