"use client";

import type { MoneyMapShare } from "../../lib/midheaven/types";

type Props = {
  busy: boolean;
  share: MoneyMapShare | null;
  onShare: () => void;
};

export function ShareMoneyMap({ busy, onShare, share }: Props) {
  return (
    <section className="midheaven-share">
      <button type="button" onClick={onShare} disabled={busy}>
        {busy ? "Creating share…" : "Share Money Map"}
      </button>
      {share && (
        <p>
          Share preview: <span>{share.url}</span>
        </p>
      )}
    </section>
  );
}
