import Link from "next/link";

export default function AxisMeasuresHome() {
  return (
    <main className="axis-measures-home">
      <header>
        <span>Axis Measures</span>
        <nav aria-label="Axis Measures">
          <Link href="/axis/calibrate">Calibrate</Link>
          <Link href="/axis/athletes">Athletes</Link>
          <Link href="/axis/measurements">Measurements</Link>
          <Link href="/axis/exports">Exports</Link>
        </nav>
      </header>

      <section>
        <p>Professional-grade basketball movement capture</p>
        <h1>Axis Calibrate</h1>
        <strong>Camera-based landmarks for reps, measurements, calibration history, and export proof.</strong>
        <Link href="/axis/calibrate">Open Calibrate</Link>
      </section>

      <div aria-label="Axis Calibrate loop">
        <span>Athlete</span>
        <span>Capture Mode</span>
        <span>Required Landmarks</span>
        <span>Capture Rep</span>
        <span>Measurements</span>
        <span>Export Proof</span>
      </div>
    </main>
  );
}
