import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  getAxisLeaderboard,
  getAxisOrganizationLeaderboard,
} from "@/lib/axis-daily/leaderboard"
import { getAxisMembershipWorlds } from "@/lib/axis-orgs/memberships"
import styles from "./page.module.css"

export default async function LeaderboardPage() {
  const identity = await getAxisRequestIdentity()
  const memberships = identity ? await getAxisMembershipWorlds(identity) : []
  const playerWorld = memberships[0]
  const [categories, organizationCategories] = identity
    ? await Promise.all([
        getAxisLeaderboard(playerWorld?.organizationId),
        getAxisOrganizationLeaderboard(),
      ])
    : [[], []]
  const leaderboardScope = playerWorld?.organizationName || "Axis"

  return (
    <main className={styles.surface}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.brand}>Axis</p>
            <h1 className={styles.title}>Leaderboard</h1>
          </div>
          <p className={styles.statement}>
            {leaderboardScope} effort records. Rankings come from saved check-ins only.
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
          <>
            <section className={styles.organizationBoard} aria-label="Organization rankings">
              <header className={styles.sectionHeader}>
                <p>Organization momentum</p>
                <span>effort culture</span>
              </header>
              <div className={styles.organizationGrid}>
                {organizationCategories.map((category) => (
                  <section className={styles.organizationCategory} key={category.id}>
                    <header className={styles.categoryHeader}>
                      <h2>{category.title}</h2>
                      <span>{category.entries.length} ranked</span>
                    </header>
                    <div className={styles.organizationRows}>
                      {category.entries.length ? (
                        category.entries.map((entry) => (
                          <Link
                            className={styles.organizationRow}
                            href={`/${entry.slug}`}
                            key={`${category.id}-${entry.id}`}
                          >
                            <span className={styles.rank}>#{entry.rank}</span>
                            <span className={styles.organizationIdentity}>
                              <strong>{entry.label}</strong>
                              <em>{entry.signal}</em>
                            </span>
                            <span className={styles.meta}>{entry.detail}</span>
                            <b>{entry.value}</b>
                          </Link>
                        ))
                      ) : (
                        <p className={styles.empty}>No organization records yet.</p>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </section>

            <section className={styles.boardGrid} aria-label="Axis leaderboard">
              {categories.map((category) => (
                <section className={styles.category} key={category.id}>
                  <header className={styles.categoryHeader}>
                    <h2>{category.title}</h2>
                    <span>{category.entries.length} ranked</span>
                  </header>
                  <div className={styles.rows}>
                    {category.entries.length ? (
                      category.entries.map((entry) => (
                        <div className={styles.row} key={`${category.id}-${entry.id}`}>
                          <span className={styles.rank}>#{entry.rank}</span>
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
          </>
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
