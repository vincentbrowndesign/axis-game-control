import { AlertTriangle, CheckCircle2, Circle, Loader2, Radio } from "lucide-react";
import type { AxisRunStep } from "../../lib/axis/types";

const stepIcons = {
  empty: Circle,
  failed: AlertTriangle,
  loading: Loader2,
  processing: Radio,
  ready: CheckCircle2,
};

export function AxisActiveRunPanel({ steps }: { steps: AxisRunStep[] }) {
  const activeStep = steps.find((step) => step.status === "processing") ?? steps.find((step) => step.status === "loading") ?? steps[0];

  return (
    <section className="axis-run-panel" aria-labelledby="axis-run-title">
      <div className="axis-section-heading axis-section-heading--compact">
        <p>Active Run</p>
        <h2 id="axis-run-title">{activeStep?.label ?? "Waiting for command"}</h2>
      </div>
      <div className="axis-run-panel__meter" aria-hidden="true">
        <span />
      </div>
      <ol className="axis-run-panel__steps">
        {steps.map((step) => {
          const Icon = stepIcons[step.status];
          return (
            <li className={`axis-run-panel__step axis-run-panel__step--${step.status}`} key={step.id}>
              <Icon size={15} aria-hidden="true" />
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
