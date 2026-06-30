import Link from "next/link";

export default function SessionsPage() {
  return (
    <div className="axis-page">
      <header className="axis-page-header">
        <Link href="/axis/calibrate" className="axis-back">← Calibrate</Link>
        <h1>Sessions</h1>
      </header>
      <p className="axis-empty">Saved calibration sessions will appear here. Complete a calibration to create the first session.</p>
    </div>
  );
}
