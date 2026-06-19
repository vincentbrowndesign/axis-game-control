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

type AuthFormState = "idle" | "submitting" | "success" | "error" | "confirmation_required";

type AxisAuthController = AxisAuthState & {
  reload: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthFormState>;
  signOut: () => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<AuthFormState>;
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

  const signIn = useCallback(async (email: string, password: string): Promise<AuthFormState> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthState({
        ...signedOutState,
        errorMessage: "Auth is not configured.",
        status: "error",
      });
      return "error";
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return "error";
    applySession(data.session ?? null);
    return "success";
  }, [applySession]);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthFormState> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthState({
        ...signedOutState,
        errorMessage: "Auth is not configured.",
        status: "error",
      });
      return "error";
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) return "error";
    applySession(data.session ?? null);
    return data.session ? "success" : "confirmation_required";
  }, [applySession]);

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
      signIn,
      signOut,
      signUp,
    }),
    [authState, reload, signIn, signOut, signUp],
  );
}

export default function AxisAuthControl({ auth }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formState, setFormState] = useState<AuthFormState>("idle");
  const [formError, setFormError] = useState<string | null>(null);

  const accountLabel = auth.email ? shortenEmail(auth.email) : "Signed in";
  const submitting = formState === "submitting";

  async function submitAuth(action: "sign_in" | "sign_up") {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password || submitting) return;

    setFormState("submitting");
    setFormError(null);
    const nextState = action === "sign_in"
      ? await auth.signIn(cleanEmail, password)
      : await auth.signUp(cleanEmail, password);
    setPassword("");
    setFormState(nextState);
    if (nextState === "error") {
      setFormError(action === "sign_in" ? "Sign in failed." : "Account could not be created.");
    }
  }

  async function handleSignOut() {
    setFormError(null);
    const ok = await auth.signOut();
    if (!ok) setFormError("Sign out failed.");
  }

  return (
    <details className="axis-auth">
      <summary aria-label={auth.status === "signed_in" ? `Account ${auth.email ?? ""}` : "Sign in"}>
        {auth.status === "loading" ? "Checking..." : auth.status === "signed_in" ? accountLabel : "Sign in"}
      </summary>

      <div className="axis-auth-popover">
        {auth.status === "signed_in" ? (
          <div className="axis-auth-signed-in">
            <p className="axis-auth-email">{auth.email}</p>
            <button type="button" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </div>
        ) : (
          <form
            className="axis-auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitAuth("sign_in");
            }}
          >
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                disabled={submitting}
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>

            <label>
              <span>Password</span>
              <input
                autoComplete="current-password"
                disabled={submitting}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>

            {auth.status === "error" && auth.errorMessage && (
              <p className="axis-auth-note">{auth.errorMessage}</p>
            )}
            {formState === "confirmation_required" && (
              <p className="axis-auth-note">Check your email to confirm the account.</p>
            )}
            {formState === "success" && (
              <p className="axis-auth-note">Signed in.</p>
            )}
            {formError && <p className="axis-auth-error">{formError}</p>}

            <div className="axis-auth-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Signing in..." : "Sign in"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitAuth("sign_up")}
              >
                Create account
              </button>
            </div>
          </form>
        )}
      </div>

      <style jsx>{`
        .axis-auth {
          flex-shrink: 0;
          font-size: 11px;
          position: relative;
          z-index: 6;
        }

        .axis-auth summary {
          color: color-mix(in srgb, var(--axis-ink) 38%, transparent);
          cursor: pointer;
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

        .axis-auth-form,
        .axis-auth-signed-in {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .axis-auth-form label {
          color: color-mix(in srgb, var(--axis-ink) 42%, transparent);
          display: flex;
          flex-direction: column;
          font-size: 10.5px;
          gap: 4px;
        }

        .axis-auth-form input {
          background: color-mix(in srgb, var(--axis-room) 72%, white);
          border: 1px solid color-mix(in srgb, var(--axis-line) 18%, transparent);
          color: color-mix(in srgb, var(--axis-ink) 88%, transparent);
          font: inherit;
          font-size: 13px;
          min-width: 0;
          outline: 0;
          padding: 8px;
          width: 100%;
        }

        .axis-auth-form input:focus {
          border-color: color-mix(in srgb, var(--axis-line) 42%, transparent);
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
          .axis-auth-popover {
            max-height: min(420px, 70dvh);
            overflow-y: auto;
            right: 0;
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
