"use client";

import type { AxisAuthStatus } from "../../app/axis/axis-auth-control";

type Props = {
  authStatus: AxisAuthStatus;
  email: string | null;
  onSignIn: () => Promise<unknown>;
  onSignOut: () => Promise<unknown>;
  status: string;
};

export function AxisTopBar({ authStatus, email, onSignIn, onSignOut, status }: Props) {
  const signedIn = authStatus === "signed_in";
  const accountLabel = signedIn ? shortenEmail(email) : "Basketball memory";

  return (
    <header className="axis-topbar">
      <div className="axis-topbar__brand">
        <strong>Axis</strong>
        <p title={email ?? undefined}>{accountLabel}</p>
      </div>

      <div className="axis-topbar__actions">
        <span className="axis-pill" data-state={signedIn ? "live" : "local"}>
          {status}
        </span>
        <button type="button" onClick={() => void (signedIn ? onSignOut() : onSignIn())}>
          {signedIn ? "Sign out" : "Sign in"}
        </button>
      </div>
    </header>
  );
}

function shortenEmail(email: string | null) {
  if (!email) return "Signed in";
  const [name, domain] = email.split("@");
  if (!domain) return email.length > 18 ? `${email.slice(0, 15)}...` : email;
  const shortName = name.length > 8 ? `${name.slice(0, 7)}...` : name;
  return `${shortName}@${domain}`;
}
