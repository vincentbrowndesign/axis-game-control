import Link from "next/link"
import styles from "@/app/page.module.css"

const ACTIVE_ORGANIZATIONS = [
  {
    name: "Bridge",
    slug: "bridge",
  },
  {
    name: "City 2 City",
    slug: "city2city",
  },
]

const TOP_SIGNALS = [
  ["ORGANIZATION", "Bridge / City 2 City"],
  ["CURRENT STREAK", "0 days"],
  ["LAST SESSION", "none"],
  ["SIGNAL", "ready"],
]

const CONTINUITY_RECORDS = [
  ["AXIS HISTORY", "No sessions yet"],
  ["LEADERBOARD", "Opens after first session"],
  ["RECENT SESSIONS", "Choose an organization"],
]

export default function HomePage() {
  return (
    <main className={styles.surface}>
      <section className={styles.homeRitualShell}>
        <header className={styles.homeRitualTop} aria-label="Axis identity">
          <div className={styles.homeIdentity}>
            <span>AXIS</span>
            <h1>ATHLETIC HISTORY</h1>
          </div>

          <div className={styles.homeSignalGrid} aria-label="Participation signals">
            {TOP_SIGNALS.map(([label, value]) => (
              <p key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </p>
            ))}
          </div>
        </header>

        <section className={styles.homeRitualCenter} aria-label="Check in">
          <p>CHECK IN</p>
          <div className={styles.homeOrgRail}>
            {ACTIVE_ORGANIZATIONS.map((organization) => (
              <Link
                className={styles.homeOrgAction}
                href={`/org/${organization.slug}/start`}
                key={organization.slug}
              >
                <span>{organization.name}</span>
                <strong>Enter</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.homeContinuityRecords} aria-label="Axis records">
          {CONTINUITY_RECORDS.map(([label, value]) => (
            <p key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </p>
          ))}
        </section>
      </section>
    </main>
  )
}
