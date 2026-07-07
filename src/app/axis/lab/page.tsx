import type { Metadata } from "next";
import Link from "next/link";
import { axisCapabilityRegistry } from "../../../axis/core/capability-registry";
import { axisReleaseManifest } from "../../../axis/core/release-manifest";

export const metadata: Metadata = {
  title: "Axis Lab",
  robots: { follow: false, index: false },
};

export default function AxisLabPage() {
  return (
    <main className="axis-lab-registry">
      <header>
        <p>Axis Lab</p>
        <h1>Capability registry</h1>
        <span>Debug, provider, and release details stay here.</span>
      </header>

      <section aria-label="Experiments">
        <article>
          <span>Experiments</span>
          <strong>Internal tools and future capabilities</strong>
          <p>
            <Link href="/axis/lab/shell">Session Shell</Link> · <Link href="/axis/calibrate">Calibrate</Link> ·{" "}
            <Link href="/axis/vision">Vision</Link> · <Link href="/axis/instrument">Instrument</Link> ·{" "}
            <Link href="/axis/clip-room">Clip Room</Link> · <Link href="/axis/lab/datasets">Datasets</Link> ·{" "}
            <Link href="/axis/lab/dataset-review">Dataset Review</Link>
          </p>
        </article>
      </section>

      <section aria-label="Release path">
        {axisReleaseManifest.map((release) => (
          <article key={release.name}>
            <span>{release.name}</span>
            <strong>{release.title}</strong>
            <em>{release.status}</em>
          </article>
        ))}
      </section>

      <section aria-label="Capability registry">
        {axisCapabilityRegistry.map((capability) => (
          <article key={capability.id}>
            <span>{capability.release}</span>
            <strong>{capability.name}</strong>
            <p>{capability.summary}</p>
            <em>{capability.status}</em>
          </article>
        ))}
      </section>
    </main>
  );
}
