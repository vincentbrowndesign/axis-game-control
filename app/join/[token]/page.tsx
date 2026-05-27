import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  getOrganizationInviteByToken,
  getOrganizationJoinSnapshot,
} from "@/lib/axis-orgs/memberships"
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
            <h1 className={styles.heading}>Invite expired.</h1>
            <p className={styles.text}>
              This invite is no longer active. Request a new link from your
              coach.
            </p>
            <div className={styles.entryActions}>
              <Link className={styles.action} href="/">
                Return home
              </Link>
              <a
                className={styles.action}
                href="mailto:?subject=Axis invite link request&body=I need a new Axis organization invite link."
              >
                Contact organization
              </a>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const snapshot = await getOrganizationJoinSnapshot(invite.organizationId)
  const identity = await getAxisRequestIdentity()
  const invitePath = `/join/${token}`

  return (
    <JoinOrganizationPanel
      activeMembers={snapshot.activeMembers}
      activeStreaks={snapshot.activeStreaks}
      authenticated={Boolean(identity)}
      checkedInToday={snapshot.checkedInToday}
      invitePath={invitePath}
      organizationAvatar={invite.organization.avatar}
      organizationName={invite.organization.name}
      role={invite.role}
      token={token}
    />
  )
}
