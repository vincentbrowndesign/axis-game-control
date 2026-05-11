type PressureMeterProps = {
  value: number;
  label: string;
};

export default function PressureMeter({ value, label }: PressureMeterProps) {
  const safeValue = Math.max(0, Math.min(value, 100));

  const tone =
    safeValue >= 70
      ? "bg-[#ff3347]"
      : safeValue >= 40
      ? "bg-[#ffb800]"
      : "bg-white";

  return (
    <section className="border border-white/10 bg-[#0b0b0b] p-4">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="text-[9px] font-bold tracking-[0.28em] text-white/30">
            PRESSURE METER
          </div>
          <div className="mt-1 text-[24px] font-black tracking-[-0.05em]">
            {label}
          </div>
        </div>

        <div className="text-[32px] font-black leading-none tracking-[-0.08em]">
          {safeValue}
        </div>
      </div>

      <div className="h-[14px] bg-white/10">
        <div className={`h-full ${tone}`} style={{ width: `${safeValue}%` }} />
      </div>

      <div className="mt-2 flex justify-between text-[9px] font-bold tracking-[0.2em] text-white/25">
        <span>LOW</span>
        <span>HIGH</span>
      </div>
    </section>
  );
}