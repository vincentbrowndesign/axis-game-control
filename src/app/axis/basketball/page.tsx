import Link from "next/link";

const dashboardSections = [
  {
    title: "Start Camera Session",
    status: "Ready",
    items: ["New session", "Open camera", "Choose overlay"],
    action: { href: "/", label: "Open Camera" },
  },
  {
    title: "Overlay Setup",
    status: "Empty",
    items: ["Active overlay appears after setup", "Calibration status appears after save", "Saved configs appear after persistence"],
  },
  {
    title: "Recordings",
    status: "Empty",
    items: ["Recent recordings appear after capture", "Recording status is local first", "Overlay attachment is required"],
  },
  {
    title: "AI Analysis",
    status: "Waiting",
    items: ["Run analysis after recording storage exists", "Suggested moments appear after worker output", "Needs review appears after Axis suggestions"],
  },
  {
    title: "Reviewed Events",
    status: "Empty",
    items: ["Approved AI events", "Corrected AI events", "Rejected AI events"],
  },
  {
    title: "Clips",
    status: "Empty",
    items: ["Generated only from reviewed events", "No manual clip tagging", "Clip storage comes later"],
  },
];

export default function AxisBasketballDashboard() {
  return (
    <main className="basketball-dashboard">
      <section className="basketball-dashboard-stack">
        <header className="basketball-dashboard-header">
          <p>Axis Basketball</p>
          <h1>Session Board</h1>
          <span>Camera + overlay + AI review</span>
        </header>

        <section className="dashboard-primary-card">
          <div>
            <p>Current product path</p>
            <strong>Start with live camera context.</strong>
          </div>
          <Link href="/">Open camera overlay</Link>
        </section>

        <section className="dashboard-grid">
          {dashboardSections.map((section) => (
            <article key={section.title} className="dashboard-card">
              <div className="dashboard-card-head">
                <h2>{section.title}</h2>
                <span>{section.status}</span>
              </div>

              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              {section.action ? <Link href={section.action.href}>{section.action.label}</Link> : null}
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
