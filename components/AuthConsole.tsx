"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Mode = "login" | "signup"

function authStatus(error: string) {
  const lower = error.toLowerCase()

  if (lower.includes("rate limit")) return "SIGNAL INTERRUPTED"
  if (lower.includes("invalid")) return "MEMORY ACCESS DENIED"
  if (lower.includes("confirm")) return "CONFIRMATION REQUIRED"
  if (lower.includes("password")) return "MEMORY ACCESS DENIED"

  return "SIGNAL INTERRUPTED"
}

export default function AuthConsole() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    setStatus("")

    const redirectTo = `${window.location.origin}/auth/callback?next=/`

    const auth =
      mode === "login"
        ? await supabase.auth.signInWithPassword({
            email,
            password,
          })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: redirectTo,
              data: {
                display_name: displayName,
              },
            },
          })

    if (auth.error) {
      setStatus(authStatus(auth.error.message))
      setLoading(false)
      return
    }

    if (!auth.data.session) {
      setStatus(
        "Confirmation required. Open the verification email, then return to Axis."
      )
      setLoading(false)
      return
    }

    const profile = await fetch("/api/profile/ensure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        mode === "signup"
          ? {
              displayName,
            }
          : {}
      ),
    })

    if (!profile.ok) {
      setStatus("MEMORY LOAD FAILED")
      setLoading(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setStatus(
        "Session cookie did not persist. Refresh and try again."
      )
      setLoading(false)
      return
    }

    await supabase.auth.refreshSession()

    setStatus(
      mode === "login"
        ? "Session linked."
        : "Profile initialized."
    )
    setLoading(false)
    router.push("/")
    router.refresh()
  }

  async function resetPassword() {
    if (!email) {
      setStatus("Enter your email first.")
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/profile`,
      }
    )

    setStatus(
      error
        ? authStatus(error.message)
        : "RECOVERY SIGNAL SENT"
    )
  }

  return (
    <section className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-end gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="pb-8">
          <p className="text-[10px] uppercase tracking-[0.55em] text-white/30">
            Axis Identity Layer
          </p>
          <h1 className="mt-6 text-[clamp(4.5rem,15vw,10rem)] font-black leading-[0.82] tracking-[-0.07em]">
            MEMORY
            <br />
            ACCESS
          </h1>
          <p className="mt-8 max-w-xl text-xl leading-relaxed text-white/45">
            Authenticate to attach uploads, replay archives, and future
            behavioral memory to one persistent Axis profile.
          </p>
        </div>

        <div className="border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-8 flex border border-white/10 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 px-4 py-3 text-xs font-black uppercase tracking-[0.28em] transition ${
                mode === "login"
                  ? "bg-white text-black"
                  : "text-white/40"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 px-4 py-3 text-xs font-black uppercase tracking-[0.28em] transition ${
                mode === "signup"
                  ? "bg-white text-black"
                  : "text-white/40"
              }`}
            >
              Signup
            </button>
          </div>

          <div className="space-y-4">
            {mode === "signup" && (
              <input
                value={displayName}
                onChange={(event) =>
                  setDisplayName(event.target.value)
                }
                placeholder="Display name"
                className="w-full border border-white/10 bg-black px-5 py-5 text-lg text-white outline-none placeholder:text-white/25"
              />
            )}

            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              type="email"
              className="w-full border border-white/10 bg-black px-5 py-5 text-lg text-white outline-none placeholder:text-white/25"
            />

            <input
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Password"
              type="password"
              className="w-full border border-white/10 bg-black px-5 py-5 text-lg text-white outline-none placeholder:text-white/25"
            />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={loading || !email || !password}
            className="mt-6 w-full bg-white px-6 py-5 text-lg font-black uppercase tracking-[0.12em] text-black transition active:scale-[0.99] disabled:opacity-40"
          >
            {loading ? "LINKING..." : "ENTER AXIS"}
          </button>

          {mode === "login" && (
            <button
              type="button"
              onClick={resetPassword}
              className="mt-4 w-full border border-white/10 px-6 py-4 text-xs font-black uppercase tracking-[0.22em] text-white/40 transition hover:text-white"
            >
              Reset Access
            </button>
          )}

          {status && (
            <p className="mt-5 text-sm leading-relaxed text-white/45">
              {status}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
