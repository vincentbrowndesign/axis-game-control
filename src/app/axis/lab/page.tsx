import type { Metadata } from "next";
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
