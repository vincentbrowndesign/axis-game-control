import {
  Bot,
  Boxes,
  FileText,
  Home,
  ScrollText,
  Settings,
  Workflow,
} from "lucide-react";
import type { AxisNavigationItem } from "../../lib/axis/types";

const navIcons: Record<string, typeof Home> = {
  automations: Workflow,
  files: FileText,
  home: Home,
  memory: Boxes,
  outputs: ScrollText,
  projects: Bot,
  settings: Settings,
};

export function AxisSidebar({ items }: { items: AxisNavigationItem[] }) {
  return (
    <aside className="axis-sidebar" aria-label="Axis navigation">
      <div className="axis-sidebar__brand">
        <span>AX</span>
        <div>
          <strong>Axis</strong>
          <small>Output layer</small>
        </div>
      </div>
      <nav>
        {items.map((item) => {
          const Icon = navIcons[item.id] ?? Home;
          return (
            <a className={item.id === "home" ? "axis-sidebar__link axis-sidebar__link--active" : "axis-sidebar__link"} href="#" key={item.id}>
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
