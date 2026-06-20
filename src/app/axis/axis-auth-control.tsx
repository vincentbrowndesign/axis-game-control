"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase-browser";

export type AxisAuthStatus = "loading" | "signed_out" | "signed_in" | "error";

export type AxisAuthState = {
  accessToken: string | null;
  email: string | null;
  errorMessage: string | null;
  status: AxisAuthStatus;
  userId: string | null;
};

type AuthFormState = "idle" | "submitting" | "error";

type AxisAuthController = AxisAuthState & {
  reload: () => Promise<void>;
  signInWithGoogle: () => Promise<AuthFormState>;
  signOut: () => Promise<boolean>;
};

type Props = {
  auth: AxisAuthController;
};

const signedOutState: AxisAuthState = {
  accessToken: null,
  email: null,
  errorMessage: null,
  status: "signed_out",
  userId: null,
};

export function useAxisAuth(): AxisAuthController {
  const [authState, setAuthState] = useState<AxisAuthState>(() =>
    isSupabaseConfigured()
      ? {
          ...signedOutState,
          status: "loading",
        }
      : {
          ...signedOutState,
          errorMessage: "Auth is not configured.",
          status: "error",
        },
  );

  const applySession = useCallback((session: Session | null, errorMessage: string | null = null) => {
    if (errorMessage) {
      setAuthState({
        ...signedOutState,
        errorMessage,
        status: "error",
      });
      return;
    }

    if (!session?.user?.id) {
      setAuthState(signedOutState);
      return;
    }

    setAuthState({
      accessToken: session.access_token,
      email: session.user.email ?? null,
      errorMessage: null,
      status: "signed_in",
      userId: session.user.id,
    });
  }, []);

  const reload = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthState({
        ...signedOutState,
        errorMessage: "Auth is not configured.",
        status: "error",
      });
      return;
    }

    const { data, error } = await supabase.auth.getSession();
    applySession(data.session ?? null, error?.message ?? null);
  }, [applySession]);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      applySession(data.session ?? null, error?.message ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      applySession(session);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [applySession]);

  const signInWithGoogle = useCallback(async (): Promise<AuthFormState> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthState({
        ...signedOutState,
        errorMessage: "Auth is not configured.",
        status: "error",
      });
      return "error";
    }

    if (typeof window === "undefined") return "error";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/axis`,
      },
    });
    if (error) return "error";
    return "submitting";
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return false;
    const { error } = await supabase.auth.signOut();
    if (error) return false;
    setAuthState(signedOutState);
    return true;
  }, []);

  return useMemo(
    () => ({
      ...authState,
      reload,
      signInWithGoogle,
      signOut,
    }),
    [authState, reload, signInWithGoogle, signOut],
  );
}

export default function AxisAuthControl({ auth }: Props) {
  const [formState, setFormState] = useState<AuthFormState>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const accountLabel = auth.email ? shortenEmail(auth.email) : "Signed in";
  const submitting = formState === "submitting";

  useEffect(() => {
    if (auth.status === "signed_in") {
      setOpen(false);
      setFormError(null);
      setFormState("idle");
    }
  }, [auth.status]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_error") === "google") {
      setOpen(true);
      setFormState("error");
      setFormError("Google sign-in did not finish. Try again.");
    }
  }, []);

  async function startGoogleSignIn() {
    if (submitting) return;

    setFormState("submitting");
    setFormError(null);
    const nextState = await auth.signInWithGoogle();
    setFormState(nextState);
    if (nextState === "error") {
      setFormError("Google sign-in did not finish. Try again.");
    }
  }

  async function handleSignOut() {
    setFormError(null);
    const ok = await auth.signOut();
    if (!ok) setFormError("Sign out failed.");
  }

  return (
    <details
      className="axis-auth"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-label={auth.status === "signed_in" ? `Account ${auth.email ?? ""}` : "Sign in"}>
        {auth.status === "loading" ? "Checking..." : auth.status === "signed_in" ? accountLabel : "Sign in"}
      </summary>

      <div className="axis-auth-popover">
        <div className="axis-auth-sheet-header">
          <div>
            <p>{auth.status === "signed_in" ? "Account" : "Save your Axis thread"}</p>
            <h2>{auth.status === "signed_in" ? accountLabel : "Sign in with Google"}</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)}>
            {auth.status === "signed_in" ? "Close" : "Continue without saving"}
          </button>
        </div>

        {auth.status === "signed_in" ? (
          <div className="axis-auth-signed-in">
            <p className="axis-auth-email">{auth.email}</p>
            <button type="button" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </div>
        ) : (
          <div
            className="axis-auth-form"
          >
            {auth.status === "error" && auth.errorMessage && (
              <p className="axis-auth-note">{auth.errorMessage}</p>
            )}
            {formError && <p className="axis-auth-error">{formError}</p>}

            <div className="axis-auth-actions">
              <button
                className="axis-auth-google"
                type="button"
                disabled={submitting}
                onClick={() => void startGoogleSignIn()}
              >
                {submitting ? "Opening Google..." : "Continue with Google"}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .axis-auth {
          flex-shrink: 0;
          font-size: 12px;
          position: relative;
          z-index: 6;
        }

        .axis-auth summary {
          color: color-mix(in srgb, var(--axis-ink) 56%, transparent);
          cursor: pointer;
          font-family: ui-sans-serif, system-ui, sans-serif;
          line-height: 1.1;
          list-style: none;
          max-width: 18ch;
          overflow: hidden;
          text-overflow: ellipsis;
          user-select: none;
          white-space: nowrap;
        }

        .axis-auth summary::-webkit-details-marker {
          display: none;
        }

        .axis-auth-popover {
          background: var(--axis-paper);
          border: 1px solid color-mix(in srgb, var(--axis-line) 18%, transparent);
          box-shadow: 0 14px 40px color-mix(in srgb, var(--axis-line) 10%, transparent);
          margin-top: 10px;
          min-width: min(300px, calc(100vw - 32px));
          padding: 12px;
          position: absolute;
          right: 0;
          top: 100%;
        }

        .axis-auth-sheet-header {
          align-items: flex-start;
          border-bottom: 1px solid color-mix(in srgb, var(--axis-line) 12%, transparent);
          display: flex;
          gap: 18px;
          justify-content: space-between;
          margin-bottom: 14px;
          padding-bottom: 12px;
        }

        .axis-auth-sheet-header p,
        .axis-auth-sheet-header h2 {
          margin: 0;
        }

        .axis-auth-sheet-header p {
          color: color-mix(in srgb, var(--axis-ink) 42%, transparent);
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .axis-auth-sheet-header h2 {
          color: color-mix(in srgb, var(--axis-ink) 86%, transparent);
          font-size: 18px;
          line-height: 1.1;
          margin-top: 5px;
        }

        .axis-auth-form,
        .axis-auth-signed-in {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .axis-auth-actions {
          display: flex;
          gap: 8px;
        }

        .axis-auth button {
          background: transparent;
          border: 0;
          border-bottom: 1px solid color-mix(in srgb, var(--axis-line) 24%, transparent);
          color: color-mix(in srgb, var(--axis-ink) 52%, transparent);
          cursor: pointer;
          font: inherit;
          font-size: 11px;
          padding: 0 0 2px;
        }

        .axis-auth-google {
          border: 1px solid color-mix(in srgb, var(--axis-line) 18%, transparent);
          border-radius: 10px;
          color: color-mix(in srgb, var(--axis-ink) 82%, transparent);
          min-height: 42px;
          padding: 0 12px;
        }

        .axis-auth button:disabled {
          cursor: default;
          opacity: 0.42;
        }

        .axis-auth-email,
        .axis-auth-note,
        .axis-auth-error {
          color: color-mix(in srgb, var(--axis-ink) 42%, transparent);
          font-size: 12px;
          line-height: 1.35;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .axis-auth-error {
          color: rgba(110, 38, 28, 0.72);
        }

        @media (max-width: 760px) {
          .axis-auth {
            position: static;
          }

          .axis-auth summary {
            align-items: center;
            background: color-mix(in srgb, var(--axis-paper) 82%, white);
            border: 1px solid color-mix(in srgb, var(--axis-line) 20%, transparent);
            border-radius: 999px;
            color: color-mix(in srgb, var(--axis-ink) 72%, transparent);
            display: inline-flex;
            font-size: 13px;
            min-height: 42px;
            padding: 0 14px;
          }

          .axis-auth-popover {
            background: color-mix(in srgb, var(--axis-paper) 96%, white);
            border: 0;
            bottom: 0;
            box-shadow: none;
            display: flex;
            flex-direction: column;
            height: 100dvh;
            left: 0;
            margin: 0;
            max-height: none;
            min-width: 0;
            overflow-x: hidden;
            overflow-y: auto;
            overscroll-behavior: contain;
            padding:
              max(24px, calc(env(safe-area-inset-top) + 18px))
              max(18px, calc(env(safe-area-inset-right) + 16px))
              max(32px, calc(env(safe-area-inset-bottom) + 24px))
              max(18px, calc(env(safe-area-inset-left) + 16px));
            position: fixed;
            right: auto;
            top: 0;
            width: 100vw;
            z-index: 1000;
          }

          .axis-auth-sheet-header {
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 22px;
            padding-bottom: 16px;
          }

          .axis-auth-sheet-header h2 {
            font-size: clamp(28px, 8vw, 38px);
            line-height: 1;
            max-width: 11ch;
          }

          .axis-auth-sheet-header button {
            border-bottom-color: color-mix(in srgb, var(--axis-line) 32%, transparent);
            flex-shrink: 0;
            font-size: 12px;
            line-height: 1.2;
            max-width: 13ch;
            text-align: right;
          }

          .axis-auth-form,
          .axis-auth-signed-in {
            gap: 18px;
          }

          .axis-auth-actions {
            align-items: stretch;
            flex-direction: column;
            gap: 12px;
            margin-top: 8px;
          }

          .axis-auth-actions button {
            border: 1px solid color-mix(in srgb, var(--axis-line) 18%, transparent);
            border-radius: 10px;
            font-size: 14px;
            min-height: 52px;
            padding: 0 14px;
          }

          .axis-auth-google {
            background: #181510;
            color: color-mix(in srgb, var(--axis-paper) 96%, white);
            font-weight: 700;
          }

          .axis-auth-note,
          .axis-auth-error {
            font-size: 13px;
          }
        }
      `}</style>
    </details>
  );
}

function shortenEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const shortName = name.length > 12 ? `${name.slice(0, 10)}...` : name;
  return `${shortName}@${domain}`;
}
