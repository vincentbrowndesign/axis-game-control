import Link from "next/link"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import {
  getOrganizationInviteByCode,
  getOrganizationJoinSnapshot,
} from "@/lib/axis-orgs/memberships"
import { JoinOrganizationPanel } from "@/components/axis-orgs/JoinOrganizationPanel"
import styles from "@/app/page.module.css"

type JoinCodePageProps = {
  params: Promise<{
    code: string
    token: string
  }>
}

export default async function JoinCodePage({ params }: JoinCodePageProps) {
  const { code, token: organization } = await params
  const invite = await getOrganizationInviteByCode(organization, code)

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

  const snapshot = await getOrganizationJoinSnapshot(invite.organizationId)
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
              {snapshot.activeMembers} active members. {snapshot.checkedInToday} checked
              in today. Sign in and step into the organization record.
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
      activeMembers={snapshot.activeMembers}
      activeStreaks={snapshot.activeStreaks}
      checkedInToday={snapshot.checkedInToday}
      inviteCode={invite.inviteCode}
      organizationAvatar={invite.organization.avatar}
      organizationName={invite.organization.name}
      role={invite.role}
      token={invite.inviteCode || invite.inviteToken}
    />
  )
}
