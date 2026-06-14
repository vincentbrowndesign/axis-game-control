"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

type Phase = "IDLE" | "LOADING" | "SENT" | "AUTHENTICATED";

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
        window.location.replace("/axis");
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = email.trim();
    if (!val || phase === "LOADING") return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Auth is not configured.");
      return;
    }

    setPhase("LOADING");
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: val,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setPhase("IDLE");
      return;
    }

    setPhase("SENT");
  }

  if (phase === "AUTHENTICATED") {
    return (
      <main className="root">
        <div className="gate">
          <span className="wordmark">Axis</span>
        </div>
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
              <button
                className="resend"
                type="button"
                onClick={() => { setPhase("IDLE"); setEmail(""); }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <p className="heading">What&apos;s your email?</p>
              <form className="form" onSubmit={handleSubmit}>
                <input
                  ref={inputRef}
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  spellCheck={false}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  required
                />
                {error && <p className="err">{error}</p>}
                <button
                  className="submit"
                  type="submit"
                  disabled={phase === "LOADING" || !email.trim()}
                >
                  {phase === "LOADING" ? "Sending…" : "Continue →"}
                </button>
              </form>
            </>
          )}
        </div>

      </div>

      <style jsx>{`

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
          gap: 28px;
          justify-content: center;
          margin: 0 auto;
          max-width: 480px;
          padding: 0 clamp(20px, 5vw, 48px) 80px;
          width: 100%;
        }

        .heading {
          color: #1a1a18;
          font-size: clamp(28px, 5vw, 44px);
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
          color: #1a1a18;
          font: inherit;
          font-size: 17px;
          line-height: 1.5;
          outline: none;
          padding: 14px 18px;
          transition: border-color 0.15s;
          width: 100%;
          box-sizing: border-box;
        }

        .input:focus {
          border-color: rgba(26, 26, 24, 0.28);
        }

        .input::placeholder {
          color: rgba(26, 26, 24, 0.28);
        }

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

        .submit:hover:not(:disabled) {
          opacity: 0.78;
        }

        .submit:disabled {
          cursor: not-allowed;
          opacity: 0.38;
        }

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

        .sub strong {
          color: #1a1a18;
          font-weight: 550;
        }

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

        .resend:hover {
          color: rgba(26, 26, 24, 0.62);
        }

      `}</style>
    </main>
  );
}
