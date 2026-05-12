type TimelineItem = {
  id: string;
  label: string;
  tone?: string;
};

type Props = {
  items: TimelineItem[];
};

export default function EventStream({
  items,
}: Props) {
  return (
    <section className="mt-8 border border-white/10 bg-white/[0.03] p-5">
      <div className="text-[11px] tracking-[0.35em] text-white/35">
        EVENT STREAM
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {items.length === 0 && (
          <div className="text-sm text-white/30">
            No events yet.
          </div>
        )}

        {items
          .slice()
          .reverse()
          .map((item) => {
            let styles =
              "border-white/10 bg-white/[0.03] text-white";

            if (item.tone === "cyan") {
              styles =
                "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
            }

            if (item.tone === "yellow") {
              styles =
                "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";
            }

            if (item.tone === "danger") {
              styles =
                "border-red-500/20 bg-red-500/10 text-red-300";
            }

            if (item.tone === "marker") {
              styles =
                "border-purple-500/20 bg-purple-500/10 text-purple-300";
            }

            if (item.tone === "clip") {
              styles =
                "border-green-500/20 bg-green-500/10 text-green-300";
            }

            return (
              <div
                key={item.id}
                className={`rounded-xl border px-4 py-3 font-bold tracking-tight ${styles}`}
              >
                {item.label}
              </div>
            );
          })}
      </div>
    </section>
  );
}