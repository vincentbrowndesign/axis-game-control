import {
  Bot,
  FileText,
  ImageIcon,
  Music2,
  Play,
  ScrollText,
  Video,
  Wand2,
  Workflow,
} from "lucide-react";
import type { AxisOutput, AxisOutputType } from "../../lib/axis/types";

const outputIcons: Record<AxisOutputType, typeof FileText> = {
  audio: Music2,
  automation: Workflow,
  clip: Play,
  file: FileText,
  image: ImageIcon,
  report: ScrollText,
  text: Bot,
  video: Video,
};

export function AxisOutputCard({ output }: { output: AxisOutput }) {
  const Icon = outputIcons[output.type];

  return (
    <article className={`axis-output-card axis-output-card--${output.status}`}>
      <div className="axis-output-card__top">
        <span className="axis-output-card__icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <span className="axis-output-card__type">{output.type}</span>
        <span className="axis-output-card__status">{formatStatus(output.status)}</span>
      </div>
      <h3>{output.title}</h3>
      {output.summary && <p>{output.summary}</p>}
      <div className="axis-output-card__meta">
        {output.sourceLabel && <span>{output.sourceLabel}</span>}
        <time dateTime={output.createdAt}>{formatOutputTime(output.createdAt)}</time>
      </div>
    </article>
  );
}

function formatStatus(status: AxisOutput["status"]) {
  if (status === "processing") return "Processing";
  if (status === "failed") return "Needs attention";
  return "Ready";
}

function formatOutputTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
