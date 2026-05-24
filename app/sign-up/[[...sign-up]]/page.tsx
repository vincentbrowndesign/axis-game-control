import { SignUp } from "@clerk/nextjs"
import Link from "next/link"

export default function SignUpPage() {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

  return (
    <main style={styles.main}>
      <section style={styles.shell}>
        <div style={styles.copy}>
          <Link href="/" style={styles.brand}>
            Axis
          </Link>
          <p style={styles.kicker}>Game memory</p>
          <h1 style={styles.heading}>Create your Axis account.</h1>
          <p style={styles.text}>
            Save game sessions and keep replay memory available after the gym.
          </p>
        </div>
        {clerkConfigured ? (
          <SignUp
            appearance={{
              elements: {
                cardBox: "axis-clerk-card",
                footerActionLink: "axis-clerk-link",
                formButtonPrimary: "axis-clerk-button",
              },
            }}
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
          />
        ) : (
          <div style={styles.notice}>
            Add Clerk keys to enable sign up.
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
