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

  return (
    <header className="axis-topbar">
      <div className="axis-topbar__brand">
        <strong>Axis</strong>
        <p>{signedIn ? email ?? "Signed in" : "Basketball memory"}</p>
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
