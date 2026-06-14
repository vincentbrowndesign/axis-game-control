"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      window.location.replace("/axis");
      return;
    }

    // Supabase sets the session from the URL hash/query params automatically.
    // Listen for the auth state change and redirect when it resolves.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        subscription.unsubscribe();
        window.location.replace("/axis");
      }
    });

    // Also check immediately in case session is already set.
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        setError("Sign-in failed. Try again.");
        return;
      }
      if (data.session) {
        subscription.unsubscribe();
        window.location.replace("/axis");
      }
    });

    // Fallback: if no session after 8 seconds, something went wrong.
    const timeout = setTimeout(() => {
      setError("Sign-in timed out. Try again.");
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <main className="root">
      <header className="hd">
        <span className="wordmark">Axis</span>
      </header>

      <div className="body">
        {error ? (
          <>
            <p className="msg">{error}</p>
            <a className="back" href="/auth">Go back</a>
          </>
        ) : (
          <div className="signing-in">
            <div className="dots" aria-label="Signing in">
              <span /><span /><span />
            </div>
          </div>
        )}
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
          align-items: center;
          display: flex;
          flex: 1;
          flex-direction: column;
          justify-content: center;
          padding-bottom: 80px;
        }

        .signing-in {
          align-items: center;
          display: flex;
        }

        .dots {
          align-items: center;
          display: flex;
          gap: 5px;
        }

        .dots span {
          animation: dotrise 1.4s ease-in-out infinite;
          background: rgba(26, 26, 24, 0.2);
          border-radius: 50%;
          display: block;
          height: 6px;
          width: 6px;
        }

        .dots span:nth-child(2) { animation-delay: 0.18s; }
        .dots span:nth-child(3) { animation-delay: 0.36s; }

        @keyframes dotrise {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 0.6; transform: translateY(-4px); }
        }

        .msg {
          color: rgba(26, 26, 24, 0.52);
          font-size: 16px;
          margin: 0 0 12px;
        }

        .back {
          color: rgba(26, 26, 24, 0.42);
          font-size: 13px;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .back:hover {
          color: rgba(26, 26, 24, 0.72);
        }

      `}</style>
    </main>
  );
}
