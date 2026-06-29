import Link from "next/link";

const dashboardSections = [
  {
    title: "Start Body Session",
    status: "Ready",
    items: ["Choose front or rear camera", "Open camera", "Step into frame"],
    action: { href: "/", label: "Open Body Tracker" },
  },
  {
    title: "Pose Overlay",
    status: "Empty",
    items: ["Head point", "Skeleton lines", "Base line"],
  },
  {
    title: "Body Context",
    status: "Empty",
    items: ["Landmark timeline", "Body center", "Movement quality"],
  },
  {
    title: "AI Body Feed",
    status: "Waiting",
    items: ["Video plus pose timeline later", "No fake reads", "No manual tags first"],
  },
  {
    title: "Future Court Layers",
    status: "Later",
    items: ["Court zones", "Spacing shapes", "Tactical overlays"],
  },
  {
    title: "Future Review",
    status: "Later",
    items: ["Coach review after AI output", "Clips after reviewed moments", "Reports after evidence exists"],
  },
];

export default function AxisBasketballDashboard() {
  return (
    <main className="basketball-dashboard">
      <section className="basketball-dashboard-stack">
        <header className="basketball-dashboard-header">
          <p>Axis Basketball</p>
          <h1>Body Board</h1>
          <span>Camera + pose overlay + body context</span>
        </header>

        <section className="dashboard-primary-card">
          <div>
            <p>Current product path</p>
            <strong>Start with the athlete&apos;s body.</strong>
          </div>
          <Link href="/">Open body tracker</Link>
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
