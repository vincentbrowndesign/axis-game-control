"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AxisAnimationPlayer } from "../../../../components/AxisAnimationPlayer";
import { getAxisProduct } from "../../../../lib/axis-cloud-store";
import type { AnimationFact } from "../../../../lib/axis-animation-renderer";

type FactsResponse = { records?: AnimationFact[] };

export default function AnimationPage() {
  const { id } = useParams<{ id: string }>();
  const [facts, setFacts] = useState<AnimationFact[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "no-facts">("loading");

  useEffect(() => {
    const product = getAxisProduct(id);
    const uploadId = product?.assetIds[0];
    if (!uploadId) {
      setStatus("no-facts");
      return;
    }

    fetch(`/api/axis/facts?upload_id=${encodeURIComponent(uploadId)}&limit=20`)
      .then((res) => res.json())
      .then((data: FactsResponse) => {
        const records = data.records ?? [];
        if (records.length) {
          setFacts(records);
          setStatus("ready");
        } else {
          setStatus("no-facts");
        }
      })
      .catch(() => setStatus("no-facts"));
  }, [id]);

  if (status === "loading") {
    return (
      <main className="axis-cloud">
        <header className="axis-cloud-header">
          <span className="axis-cloud-mark">AXIS</span>
          <div>
            <p>Animation</p>
            <h1>Loading</h1>
          </div>
        </header>
        <p className="axis-cloud-empty">Reading facts…</p>
      </main>
    );
  }

  if (status === "no-facts" || !facts) {
    return (
      <main className="axis-cloud">
        <header className="axis-cloud-header">
          <span className="axis-cloud-mark">AXIS</span>
          <div>
            <p>Animation</p>
            <h1>No facts yet</h1>
          </div>
        </header>
        <p className="axis-cloud-empty">
          Decode this clip first to generate the animation.
        </p>
        <Link className="axis-cloud-primary" href={`/studio/${id}`}>
          Back to artifact
        </Link>
      </main>
    );
  }

  return (
    <main className="axis-cloud">
      <header className="axis-cloud-header">
        <Link className="axis-cloud-mark" href={`/studio/${id}`}>
          AXIS
        </Link>
        <div>
          <p>Animation</p>
          <h1>What Axis saw</h1>
        </div>
      </header>

      <AxisAnimationPlayer facts={facts} />

      <nav className="axis-cloud-nav" aria-label="Axis navigation">
        <Link href="/">Sources</Link>
        <Link href="/chat">Chat</Link>
        <Link href="/studio">Studio</Link>
      </nav>
    </main>
  );
}
