import { SignIn } from "@clerk/nextjs"
import { hasValidClerkServerConfig } from "@/lib/axis-auth/clerkConfig"
import Link from "next/link"

export default function SignInPage() {
  const clerkConfigured = hasValidClerkServerConfig()

  return (
    <main style={styles.main}>
      <section style={styles.shell}>
        <div style={styles.copy}>
          <Link href="/" style={styles.brand}>
            Axis
          </Link>
          <p style={styles.kicker}>Game memory</p>
          <h1 style={styles.heading}>Sign in to continue.</h1>
          <p style={styles.text}>
            Keep uploads, sessions, and replay memory connected to one account.
          </p>
        </div>
        {clerkConfigured ? (
          <SignIn
            appearance={{
              elements: {
                cardBox: "axis-clerk-card",
                footerActionLink: "axis-clerk-link",
                formButtonPrimary: "axis-clerk-button",
              },
            }}
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
          />
        ) : (
          <div style={styles.notice}>
            Add Clerk keys to enable sign in.
          </div>
        )}
      </section>
    </main>
  )
}

const styles = {
  main: {
    alignItems: "center",
    background: "#050505",
    color: "#f4f4f2",
    display: "flex",
    minHeight: "100dvh",
    padding: "32px",
  },
  shell: {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "32px",
    justifyContent: "center",
    margin: "0 auto",
    maxWidth: "980px",
    width: "100%",
  },
  copy: {
    maxWidth: "420px",
  },
  brand: {
    color: "#f4f4f2",
    fontSize: "13px",
    letterSpacing: "0",
    textDecoration: "none",
    textTransform: "uppercase" as const,
  },
  kicker: {
    color: "rgba(244, 244, 242, 0.48)",
    fontSize: "12px",
    margin: "48px 0 12px",
    textTransform: "uppercase" as const,
  },
  heading: {
    fontSize: "clamp(32px, 6vw, 64px)",
    fontWeight: 500,
    letterSpacing: "0",
    lineHeight: 0.96,
    margin: 0,
  },
  text: {
    color: "rgba(244, 244, 242, 0.6)",
    fontSize: "15px",
    lineHeight: 1.6,
    margin: "20px 0 0",
  },
  notice: {
    border: "1px solid rgba(244, 244, 242, 0.14)",
    color: "rgba(244, 244, 242, 0.64)",
    fontSize: "14px",
    padding: "20px",
    width: "min(100%, 400px)",
  },
}
