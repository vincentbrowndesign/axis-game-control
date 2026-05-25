import { SignUp } from "@clerk/nextjs"
import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getAxisHomeUrl, getAxisSignInUrl } from "@/lib/axis-auth/authUrls"
import { hasValidClerkServerConfig } from "@/lib/axis-auth/clerkConfig"
import styles from "./page.module.css"

export default async function HomePage() {
  const identity = await getAxisRequestIdentity()
  const clerkConfigured = hasValidClerkServerConfig()
  const homeUrl = getAxisHomeUrl()
  const signInUrl = getAxisSignInUrl()

  return (
    <main className={styles.surface}>
      <section className={styles.shell}>
        <div className={styles.copy}>
          <p className={styles.brand}>Axis</p>
          <p className={styles.kicker}>Game memory</p>
          <h1 className={styles.heading}>Create your Axis account.</h1>
          <p className={styles.text}>
            Save game sessions and keep replay memory available after the gym.
          </p>
        </div>

        <div className={styles.authPanel}>
          {identity ? (
            <div className={styles.signedIn}>
              <p className={styles.kicker}>Signed in</p>
              <h2 className={styles.panelTitle}>Your Axis account is active.</h2>
              <div className={styles.actions}>
                <Link className={styles.action} href="/check-in">
                  Check in
                </Link>
                <Link className={styles.action} href="/memory">
                  Memory
                </Link>
              </div>
            </div>
          ) : clerkConfigured ? (
            <SignUp
              appearance={{
                elements: {
                  cardBox: "axis-clerk-card",
                  footerActionLink: "axis-clerk-link",
                  formButtonPrimary: "axis-clerk-button",
                },
              }}
              forceRedirectUrl={homeUrl}
              routing="hash"
              signInUrl={signInUrl}
            />
          ) : (
            <div className={styles.notice}>Add Clerk keys to enable sign up.</div>
          )}
        </div>
      </section>
    </main>
  )
}
