import Link from "next/link";

const dashboardSections = [
  {
    title: "Start Full Body Session",
    status: "Ready",
    items: ["Choose front or rear camera", "Open camera", "Step fully into frame"],
    action: { href: "/", label: "Open Full Body Tracker" },
  },
  {
    title: "Full Body Gate",
    status: "Empty",
    items: ["Head visible", "Lower body visible", "Feet visible"],
  },
  {
    title: "Pose Overlay",
    status: "Empty",
    items: ["Head point", "Full skeleton", "Base line"],
  },
  {
    title: "Full Body Reads",
    status: "Empty",
    items: ["Stance", "Balance", "Knee bend"],
  },
  {
    title: "AI Body Feed",
    status: "Waiting",
    items: ["Full-body landmark timeline later", "No fake reads", "No manual tags first"],
  },
  {
    title: "Future Review",
    status: "Later",
    items: ["Body read review after AI output", "Reports after evidence exists", "No clip-first workflow"],
  },
];

export default function AxisBasketballDashboard() {
  return (
    <main className="basketball-dashboard">
      <section className="basketball-dashboard-stack">
        <header className="basketball-dashboard-header">
          <p>Axis Basketball</p>
          <h1>Full Body Board</h1>
          <span>Camera + full-body gate + pose context</span>
        </header>

        <section className="dashboard-primary-card">
          <div>
            <p>Current product path</p>
            <strong>Start with the full athlete, head to toe.</strong>
          </div>
          <Link href="/">Open full body tracker</Link>
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
