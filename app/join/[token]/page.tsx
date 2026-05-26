import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getOrganizationInviteByToken } from "@/lib/axis-orgs/memberships"
import { JoinOrganizationPanel } from "@/components/axis-orgs/JoinOrganizationPanel"
import styles from "@/app/page.module.css"

type JoinPageProps = {
  params: Promise<{
    token: string
  }>
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params
  const invite = await getOrganizationInviteByToken(token)

  if (!invite || invite.status !== "pending") {
    return (
      <main className={styles.surface}>
        <section className={styles.entryShell}>
          <div className={styles.entryCopy}>
            <p className={styles.brand}>Axis</p>
            <p className={styles.kicker}>Organization invite</p>
            <h1 className={styles.heading}>Invite closed.</h1>
            <p className={styles.text}>
              Ask your coach or organization admin for a fresh invite link.
            </p>
          </div>
        </section>
      </main>
    )
  }

  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return (
      <main className={styles.surface}>
        <section className={styles.entryShell}>
          <div className={styles.entryCopy}>
            <p className={styles.brand}>{invite.organization.name}</p>
            <p className={styles.kicker}>Organization invite</p>
            <h1 className={styles.heading}>Sign in to join.</h1>
            <p className={styles.text}>
              Your organization history needs an identity before the invite can
              be accepted.
            </p>
            <div className={styles.entryActions}>
              <Link className={styles.action} href="/sign-in">
                Sign in
              </Link>
              <Link className={styles.action} href="/sign-up">
                Sign up
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <JoinOrganizationPanel
      organizationAvatar={invite.organization.avatar}
      organizationName={invite.organization.name}
      role={invite.role}
      token={token}
    />
  )
}
