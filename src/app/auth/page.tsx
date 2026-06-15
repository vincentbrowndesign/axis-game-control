"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

type Phase = "IDLE" | "LOADING" | "SENT" | "OAUTH_LOADING" | "AUTHENTICATED";
type OAuthProvider = "google" | "apple";

function getReturnPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/auth")) {
    return "/axis";
  }
  return next;
}

export default function AuthPage() {
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setPhase("AUTHENTICATED");
        window.location.replace(getReturnPath());
      }
    });
  }, []);

  async function handleOAuth(provider: OAuthProvider) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Auth is not configured."); return; }
    setPhase("OAUTH_LOADING");
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(getReturnPath())}`;
    console.log("AXIS_AUTH_TRACE oauth_redirect", { provider, redirectTo });
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setPhase("IDLE");
    }
    // On success, Supabase redirects the browser — no further action needed.
  }

  async function handleGuest() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Auth is not configured."); return; }
    setPhase("OAUTH_LOADING");
    setError(null);
    const { error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError) {
      setError(anonError.message);
      setPhase("IDLE");
      return;
    }
    window.location.replace(getReturnPath());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = email.trim();
    if (!val || phase === "LOADING") return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Auth is not configured."); return; }
    setPhase("LOADING");
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: val,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getReturnPath())}`,
      },
    });
    if (signInError) {
      setError(signInError.message);
      setPhase("IDLE");
      return;
    }
    setPhase("SENT");
  }

  const isLoading = phase === "LOADING" || phase === "OAUTH_LOADING" || phase === "AUTHENTICATED";

  if (phase === "AUTHENTICATED") {
    return (
      <main className="root">
        <div className="gate"><span className="wordmark">Axis</span></div>
        <style jsx>{rootStyles}</style>
      </main>
    );
  }

  return (
    <main className="root">
      <div className="shell">

        <header className="hd">
          <span className="wordmark">Axis</span>
        </header>

        <div className="body">
          {phase === "SENT" ? (

            <div className="sent">
              <p className="heading">Check your email.</p>
              <p className="sub">We sent a link to <strong>{email}</strong>. Click it to continue.</p>
              <button className="resend" type="button" onClick={() => { setPhase("IDLE"); setEmail(""); }}>
                Use a different email
              </button>
            </div>

          ) : (
            <>
              <p className="heading">Sign in to Axis.</p>

              {/* OAuth providers */}
              <div className="oauth-group">
                <button
                  className="oauth-btn"
                  onClick={() => void handleOAuth("google")}
                  disabled={isLoading}
                  type="button"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
                <button
                  className="oauth-btn"
                  onClick={() => void handleOAuth("apple")}
                  disabled={isLoading}
                  type="button"
                >
                  <AppleIcon />
                  Continue with Apple
                </button>
              </div>

              <div className="divider">
                <span className="divider-text">or</span>
              </div>

              {/* Email OTP */}
              <form className="form" onSubmit={(e) => void handleSubmit(e)}>
                <input
                  ref={inputRef}
                  className="input"
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  spellCheck={false}
                  disabled={isLoading}
                  required
                />
                {error && <p className="err">{error}</p>}
                <button className="submit" type="submit" disabled={isLoading || !email.trim()}>
                  {phase === "LOADING" ? "Sending…" : "Continue with Email →"}
                </button>
              </form>

              {/* Guest */}
              <button
                className="guest-btn"
                type="button"
                onClick={() => void handleGuest()}
                disabled={isLoading}
              >
                Continue as guest
              </button>
              <p className="guest-note">Guest sessions are saved to this device only.</p>
            </>
          )}
        </div>

      </div>

      <style jsx>{rootStyles}</style>
      <style jsx>{`

        .oauth-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }

        .oauth-btn {
          align-items: center;
          background: #fff;
          border: 1.5px solid rgba(26, 26, 24, 0.14);
          border-radius: 12px;
          color: #1a1a18;
          cursor: pointer;
          display: flex;
          font: inherit;
          font-size: 15px;
          font-weight: 500;
          gap: 12px;
          height: 50px;
          justify-content: center;
          padding: 0 20px;
          transition: border-color 0.12s, background 0.12s;
          width: 100%;
        }

        .oauth-btn:hover:not(:disabled) {
          background: #f4f4f2;
          border-color: rgba(26, 26, 24, 0.24);
        }

        .oauth-btn:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }

        .divider {
          align-items: center;
          display: flex;
          gap: 12px;
          width: 100%;
        }

        .divider::before,
        .divider::after {
          border-top: 1px solid rgba(26, 26, 24, 0.1);
          content: "";
          flex: 1;
        }

        .divider-text {
          color: rgba(26, 26, 24, 0.32);
          font-size: 12px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .guest-btn {
          align-self: center;
          background: transparent;
          border: 0;
          color: rgba(26, 26, 24, 0.38);
          cursor: pointer;
          font: inherit;
          font-size: 13px;
          margin-top: 4px;
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: color 0.12s;
        }

        .guest-btn:hover:not(:disabled) {
          color: rgba(26, 26, 24, 0.62);
        }

        .guest-btn:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }

        .guest-note {
          color: rgba(26, 26, 24, 0.22);
          font-size: 11px;
          letter-spacing: 0.02em;
          margin: 0;
          text-align: center;
        }

      `}</style>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M14.045 9.38c-.014-1.538.706-2.706 2.16-3.568-.814-1.163-2.047-1.805-3.69-1.935-1.548-.127-3.24.9-3.856.9-.647 0-2.145-.86-3.344-.86C3.19 3.948 1 5.549 1 8.804c0 .96.175 1.953.524 2.977.467 1.338 2.15 4.616 3.905 4.56.83-.02 1.414-.59 2.8-.59 1.342 0 1.87.59 2.822.59 1.769-.026 3.29-3.034 3.73-4.375-.01-.005-2.73-1.056-2.736-3.586z" fill="#1a1a18"/>
      <path d="M11.5 1c.08 1.14-.308 2.253-1 3.07-.696.82-1.744 1.395-2.75 1.32-.104-1.07.376-2.19 1.01-2.96C9.42 1.596 10.56 1.044 11.5 1z" fill="#1a1a18"/>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const rootStyles = `
  .root {
    background: #fafaf9;
    color: #1a1a18;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    min-height: 100dvh;
  }

  .gate {
    align-items: center;
    display: flex;
    flex: 1;
    justify-content: center;
  }

  .shell {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  .hd {
    align-items: center;
    border-bottom: 1px solid rgba(26, 26, 24, 0.07);
    display: flex;
    flex-shrink: 0;
    padding: 14px clamp(20px, 5vw, 48px);
  }

  .wordmark {
    color: rgba(26, 26, 24, 0.28);
    font-size: 12px;
    font-weight: 750;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .body {
    align-items: flex-start;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 20px;
    justify-content: center;
    margin: 0 auto;
    max-width: 400px;
    padding: 0 clamp(20px, 5vw, 48px) 80px;
    width: 100%;
  }

  .heading {
    color: #1a1a18;
    font-size: clamp(24px, 4.5vw, 36px);
    font-weight: 700;
    line-height: 1.1;
    margin: 0;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .input {
    background: #fff;
    border: 1.5px solid rgba(26, 26, 24, 0.12);
    border-radius: 12px;
    box-sizing: border-box;
    color: #1a1a18;
    font: inherit;
    font-size: 16px;
    line-height: 1.5;
    outline: none;
    padding: 13px 18px;
    transition: border-color 0.15s;
    width: 100%;
  }

  .input:focus { border-color: rgba(26, 26, 24, 0.28); }
  .input::placeholder { color: rgba(26, 26, 24, 0.28); }
  .input:disabled { opacity: 0.5; }

  .err {
    color: rgba(26, 26, 24, 0.52);
    font-size: 13px;
    margin: 0;
  }

  .submit {
    align-items: center;
    align-self: flex-start;
    background: #1a1a18;
    border: 0;
    border-radius: 10px;
    color: #fafaf9;
    cursor: pointer;
    font: inherit;
    font-size: 15px;
    font-weight: 500;
    height: 44px;
    padding: 0 22px;
    transition: opacity 0.15s;
  }

  .submit:hover:not(:disabled) { opacity: 0.78; }
  .submit:disabled { cursor: not-allowed; opacity: 0.38; }

  .sent {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sub {
    color: rgba(26, 26, 24, 0.52);
    font-size: 16px;
    line-height: 1.5;
    margin: 0;
  }

  .sub strong { color: #1a1a18; font-weight: 550; }

  .resend {
    align-self: flex-start;
    background: transparent;
    border: 0;
    color: rgba(26, 26, 24, 0.38);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    margin-top: 8px;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 3px;
    transition: color 0.12s;
  }

  .resend:hover { color: rgba(26, 26, 24, 0.62); }
`;
