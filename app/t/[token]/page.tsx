import Link from "next/link"
import { notFound } from "next/navigation"
import { checkInWithIdentityToken } from "@/lib/axis-daily/token-check-in"
import { getIdentityTokenByValue } from "@/lib/axis-daily/identity-tokens"
import styles from "@/app/page.module.css"

type TokenTapPageProps = {
  params: Promise<{
    token: string
  }>
}

export default async function TokenTapPage({ params }: TokenTapPageProps) {
  const { token: tokenValue } = await params
  const token = await getIdentityTokenByValue(tokenValue)

  if (!token) notFound()

  const result = await checkInWithIdentityToken(token)

  return (
    <main className={styles.surface}>
      <section className={styles.entryShell}>
        <div className={styles.entryCopy}>
          <p className={styles.brand}>Axis</p>
          <p className={styles.kicker}>Identity token</p>
          <h1 className={styles.heading}>
            {result.ok ? "Checked in." : "Not saved."}
          </h1>
          <p className={styles.text}>
            {result.ok
              ? result.duplicate
                ? "History was already alive today."
                : "Your history updated from your Axis tag."
              : "The tag was recognized, but the check-in did not save."}
          </p>
          <div className={styles.entryActions}>
            <Link className={styles.action} href="/">
              Continue
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
