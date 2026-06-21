import { Camera, Mic, Paperclip, Send, Type } from "lucide-react";

const inputModes = [
  { icon: Type, label: "Type" },
  { icon: Mic, label: "Voice" },
  { icon: Paperclip, label: "Upload" },
  { icon: Camera, label: "Camera" },
];

export function AxisCommandComposer() {
  return (
    <section className="axis-command" aria-labelledby="axis-command-title">
      <div className="axis-command__header">
        <p>Command</p>
        <h2 id="axis-command-title">What do you want Axis to do?</h2>
      </div>
      <form className="axis-command__form">
        <textarea aria-label="Axis command" placeholder="What do you want Axis to do?" rows={4} />
        <div className="axis-command__footer">
          <div className="axis-command__modes" aria-label="Input modes">
            {inputModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button type="button" key={mode.label}>
                  <Icon size={16} aria-hidden="true" />
                  {mode.label}
                </button>
              );
            })}
          </div>
          <button className="axis-command__send" type="button">
            <Send size={16} aria-hidden="true" />
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
