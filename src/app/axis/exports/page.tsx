import Link from "next/link";

export default function ExportsPage() {
  return (
    <div className="axis-page">
      <header className="axis-page-header">
        <Link href="/axis/calibrate" className="axis-back">← Calibrate</Link>
        <h1>Exports</h1>
      </header>
      <p className="axis-empty">Proof cards, clips, and reports will appear here after calibration sessions are saved.</p>
    </div>
  );
}
