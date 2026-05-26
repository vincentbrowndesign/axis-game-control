import Link from "next/link"
import { headers } from "next/headers"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getOrCreateIdentityToken } from "@/lib/axis-daily/identity-tokens"
import styles from "@/app/page.module.css"

export default async function IdentityTokenPage() {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return (
      <main className={styles.surface}>
        <section className={styles.entryShell}>
          <div className={styles.entryCopy}>
            <p className={styles.brand}>Axis</p>
            <p className={styles.kicker}>Identity token</p>
            <h1 className={styles.heading}>Sign in.</h1>
            <p className={styles.text}>
              Connect a personal Axis tag after signing in.
            </p>
            <div className={styles.entryActions}>
              <Link className={styles.action} href="/sign-in">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const token = await getOrCreateIdentityToken({ identity })
  const headerList = await headers()
  const host = headerList.get("host") || "ontheaxis.com"
  const protocol = host.includes("localhost") ? "http" : "https"
  const tapPath = token ? `/t/${token.token}` : ""
  const tapUrl = token ? `${protocol}://${host}${tapPath}` : ""

  return (
    <main className={styles.surface}>
      <section className={styles.entryShell}>
        <div className={styles.entryCopy}>
          <p className={styles.brand}>Axis</p>
          <p className={styles.kicker}>Identity token</p>
          <h1 className={styles.heading}>Save card.</h1>
          <p className={styles.text}>
            Program this URL into an NFC tag or turn it into a QR code. Tapping it
            checks you in and updates your history.
          </p>
          {token ? (
            <div className={styles.identityTokenCard}>
              <span>{token.label}</span>
              <strong>{tapUrl}</strong>
              <em>{token.lastUsedAt ? "Used before" : "Ready to link"}</em>
            </div>
          ) : (
            <p className={styles.text}>Identity token is not ready.</p>
          )}
          <div className={styles.entryActions}>
            {tapPath ? (
              <Link className={styles.action} href={tapPath}>
                Test tap
              </Link>
            ) : null}
            <Link className={styles.action} href="/">
              Return home
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
