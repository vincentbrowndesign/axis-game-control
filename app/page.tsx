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

export default function HomePage() {
  return (
    <main className={styles.surface}>
      <section className={styles.modeShell}>
        <header className={styles.modeHeader}>
          <h1 className={styles.modeHeading}>AXIS</h1>
        </header>

        <div className={styles.modeGrid}>
          {ACTIVE_ORGANIZATIONS.map((organization) => (
            <Link
              className={styles.modeCard}
              href={`/org/${organization.slug}/start`}
              key={organization.slug}
            >
              <strong>{organization.name}</strong>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
