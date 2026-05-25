import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getAxisLeaderboard } from "@/lib/axis-daily/leaderboard"
import styles from "./page.module.css"

export default async function LeaderboardPage() {
  const identity = await getAxisRequestIdentity()
  const categories = identity ? await getAxisLeaderboard() : []

  return (
    <main className={styles.surface}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.brand}>Axis</p>
            <h1 className={styles.title}>Leaderboard</h1>
          </div>
          <p className={styles.statement}>
            People are showing up. Where do you stand?
          </p>
        </header>

        {!identity ? (
          <section className={styles.emptyPanel}>
            <p>Sign in to view effort continuity.</p>
            <Link className={styles.link} href="/sign-in">
              Sign in
            </Link>
          </section>
        ) : (
          <section className={styles.boardGrid} aria-label="Axis leaderboard">
            {categories.map((category) => (
              <section className={styles.category} key={category.id}>
                <h2>{category.title}</h2>
                <div className={styles.rows}>
                  {category.entries.length ? (
                    category.entries.map((entry) => (
                      <div className={styles.row} key={`${category.id}-${entry.id}`}>
                        <span className={styles.rank}>
                          {entry.rank.toString().padStart(2, "0")}
                        </span>
                        <span className={styles.identity}>{entry.label}</span>
                        <span className={styles.meta}>{entry.meta}</span>
                        <strong>{entry.value}</strong>
                      </div>
                    ))
                  ) : (
                    <p className={styles.empty}>No records yet.</p>
                  )}
                </div>
              </section>
            ))}
          </section>
        )}

        <footer className={styles.footer}>
          <Link className={styles.link} href="/">
            Check in
          </Link>
          <Link className={styles.link} href="/memory">
            Axis History
          </Link>
        </footer>
      </section>
    </main>
  )
}
