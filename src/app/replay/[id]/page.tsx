"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AxisAnimationPlayer } from "../../../components/AxisAnimationPlayer";
import {
  exportProduct,
  getAxisProduct,
  type AxisProduct,
} from "../../../lib/axis-cloud-store";
import {
  factsHaveReplayUnderstanding,
  type AnimationFact,
} from "../../../lib/axis-animation-renderer";

type FactsResponse = { records?: AnimationFact[] };

export default function TacticalReplayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [facts, setFacts] = useState<AnimationFact[] | null>(null);
  const [product, setProduct] = useState<AxisProduct | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    const storedProduct = getAxisProduct(id);
    const uploadId = storedProduct?.assetIds[0] ?? id;
    setProduct(storedProduct);

    fetch(`/api/axis/facts?upload_id=${encodeURIComponent(uploadId)}&limit=20`)
      .then((res) => res.json())
      .then((data: FactsResponse) => {
        const records = data.records ?? [];
        if (factsHaveReplayUnderstanding(records)) {
          setFacts(records);
          setStatus("ready");
        } else {
          setStatus("empty");
        }
      })
      .catch(() => setStatus("empty"));
  }, [id]);

  function handleReplaySaved() {
    if (product) exportProduct(product.id, "camera-roll");
    router.push("/");
  }

  if (status === "loading") {
    return (
      <ReplayShell eyebrow="Replay" title="Loading">
        <p className="axis-cloud-empty">Preparing replay.</p>
      </ReplayShell>
    );
  }

  if (status === "empty" || !facts) {
    return (
      <ReplayShell eyebrow="Replay" title="Not enough understanding yet">
        <p className="axis-cloud-empty">
          Not enough understanding yet.
        </p>
        <Link className="axis-cloud-primary" href="/">
          Sources
        </Link>
      </ReplayShell>
    );
  }

  return (
    <ReplayShell eyebrow="Tactical Replay" title="What Axis saw">
      <AxisAnimationPlayer facts={facts} onReplaySaved={product ? handleReplaySaved : undefined} />
    </ReplayShell>
  );
}

function ReplayShell({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="axis-cloud axis-replay-page">
      <header className="axis-cloud-header">
        <Link className="axis-cloud-mark" href="/">
          AXIS
        </Link>
        <div>
          <p>{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </header>

      {children}

      <nav className="axis-cloud-nav" aria-label="Axis navigation">
        <Link href="/">Sources</Link>
        <Link href="/chat">Chat</Link>
        <Link href="/studio">Studio</Link>
      </nav>
    </main>
  );
}
