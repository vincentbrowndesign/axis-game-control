import Link from "next/link"
import styles from "@/app/page.module.css"

const ACTIVE_ORGANIZATIONS = [
  {
    avatar: "BR",
    name: "Bridge",
    slug: "bridge",
  },
  {
    avatar: "C2",
    name: "City 2 City",
    slug: "city2city",
  },
]

export default function HomePage() {
  return (
    <main className={styles.surface}>
      <section className={styles.modeShell}>
        <header className={styles.modeHeader}>
          <p className={styles.brand}>Axis</p>
          <h1 className={styles.modeHeading}>AXIS</h1>
          <p className={styles.modeText}>Choose team.</p>
        </header>

        <div className={styles.modeGrid}>
          {ACTIVE_ORGANIZATIONS.map((organization) => (
            <Link
              className={styles.modeCard}
              href={`/org/${organization.slug}/start`}
              key={organization.slug}
            >
              <span>{organization.avatar}</span>
              <strong>{organization.name}</strong>
              <small>Enter</small>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
