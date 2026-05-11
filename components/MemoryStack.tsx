type MemoryStackProps = {
  memory: string[];
};

export default function MemoryStack({ memory }: MemoryStackProps) {
  return (
    <section className="border border-white/10 bg-[#0b0b0b] p-4">
      <div className="mb-4">
        <div className="text-[9px] font-bold tracking-[0.28em] text-white/30">
          MEMORY STACK
        </div>
        <div className="mt-1 text-[18px] font-black tracking-[-0.04em]">
          GAME READ
        </div>
      </div>

      <div className="space-y-2">
        {memory.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="border-t border-white/10 pt-2 text-[13px] font-bold text-white/70"
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}