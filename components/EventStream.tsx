export type AxisEvent = {
  id: number;
  time: string;
  team: "HOME" | "AWAY";
  label: string;
  value: number;
};

type EventStreamProps = {
  events: AxisEvent[];
};

export default function EventStream({ events }: EventStreamProps) {
  return (
    <section className="border border-white/10 bg-[#0b0b0b] p-4">
      <div className="mb-4">
        <div className="text-[9px] font-bold tracking-[0.28em] text-white/30">
          EVENT STREAM
        </div>
        <div className="mt-1 text-[18px] font-black tracking-[-0.04em]">
          GAME SIGNALS
        </div>
      </div>

      <div className="max-h-[150px] space-y-2 overflow-hidden">
        {events.length === 0 ? (
          <div className="text-[13px] font-medium text-white/35">
            Waiting for first signal.
          </div>
        ) : (
          [...events].reverse().slice(0, 5).map((event) => (
            <div
              key={event.id}
              className="grid grid-cols-[42px_50px_1fr_auto] items-center border-t border-white/10 pt-2 text-[12px]"
            >
              <span className="font-bold text-white/35">{event.time}</span>
              <span className="font-black">{event.team}</span>
              <span className="font-medium text-white/70">{event.label}</span>
              <span className="font-black text-[#ffb800]">+{event.value}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}