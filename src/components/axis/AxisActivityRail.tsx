import { Activity, Database, FolderKanban, HardDrive, ListChecks } from "lucide-react";
import type { AxisActivityItem, AxisProjectStatus } from "../../lib/axis/types";

export function AxisActivityRail({
  activity,
  projectStatus,
}: {
  activity: AxisActivityItem[];
  projectStatus: AxisProjectStatus;
}) {
  return (
    <aside className="axis-activity-rail" aria-label="Axis activity and project status">
      <section className="axis-rail-card">
        <div className="axis-rail-card__heading">
          <FolderKanban size={17} aria-hidden="true" />
          <h2>Project</h2>
        </div>
        <strong>{projectStatus.activeProject}</strong>
        <dl>
          <div>
            <dt>Queued runs</dt>
            <dd>{projectStatus.queuedRuns}</dd>
          </div>
          <div>
            <dt>Memory</dt>
            <dd>{formatState(projectStatus.memoryState)}</dd>
          </div>
          <div>
            <dt>Files</dt>
            <dd>{formatState(projectStatus.storageState)}</dd>
          </div>
        </dl>
      </section>

      <section className="axis-rail-card">
        <div className="axis-rail-card__heading">
          <Activity size={17} aria-hidden="true" />
          <h2>Activity</h2>
        </div>
        <div className="axis-activity-list">
          {activity.map((item) => (
            <article className={`axis-activity-item axis-activity-item--${item.status}`} key={item.id}>
              <span aria-hidden="true" />
              <div>
                <h3>{item.label}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="axis-rail-card axis-rail-card--quiet">
        <div className="axis-rail-card__heading">
          <ListChecks size={17} aria-hidden="true" />
          <h2>States</h2>
        </div>
        <ul>
          <li>
            <Database size={14} aria-hidden="true" />
            Empty states ready
          </li>
          <li>
            <HardDrive size={14} aria-hidden="true" />
            Ready and failed outputs visible
          </li>
        </ul>
      </section>
    </aside>
  );
}

function formatState(value: AxisProjectStatus["memoryState"] | AxisProjectStatus["storageState"]) {
  if (value === "processing") return "Processing";
  if (value === "failed") return "Needs attention";
  if (value === "empty") return "Empty";
  return "Ready";
}
