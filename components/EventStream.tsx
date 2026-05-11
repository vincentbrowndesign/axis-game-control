type TimelineItem = {
  id: string;
  label: string;
  tone: string;
};

type Props = {
  items: TimelineItem[];
};

export default function EventStream({
  items,
}: Props) {
  return (
    <div className="space-y-3">
      {[...items]
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

          return (
            <div
              key={item.id}
              className={`flex items-center justify-between border px-4 py-4 font-black tracking-[-0.03em] ${styles}`}
            >
              <div>{item.label}</div>
            </div>
          );
        })}
    </div>
  );
}