import { Box, FileText, ImageIcon, Mic, MoreHorizontal, ScrollText, Sparkles, Type, Video } from "lucide-react";
import type { AxisCapability } from "../../lib/axis/types";

const capabilityIcons: Record<string, typeof Type> = {
  automations: Sparkles,
  images: ImageIcon,
  more: MoreHorizontal,
  reports: ScrollText,
  text: Type,
  video: Video,
  vision: Box,
  voice: Mic,
};

export function AxisCapabilityGrid({ capabilities }: { capabilities: AxisCapability[] }) {
  return (
    <section className="axis-capabilities" aria-labelledby="axis-capabilities-title">
      <div className="axis-section-heading">
        <p>Capabilities</p>
        <h2 id="axis-capabilities-title">One surface for every output</h2>
      </div>
      <div className="axis-capabilities__grid">
        {capabilities.map((capability) => {
          const Icon = capabilityIcons[capability.id] ?? FileText;
          return (
            <article className="axis-capability-card" key={capability.id}>
              <div>
                <span aria-hidden="true">
                  <Icon size={18} />
                </span>
                <small>{formatCapabilityStatus(capability.status)}</small>
              </div>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatCapabilityStatus(status: AxisCapability["status"]) {
  if (status === "coming_soon") return "Soon";
  if (status === "connected") return "Connected";
  return "Ready";
}
