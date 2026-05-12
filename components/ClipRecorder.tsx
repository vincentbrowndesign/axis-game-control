"use client";

type Props = {
  isRecording: boolean;
  onStart: () => void;
  onClip: () => void;
};

export default function ClipRecorder({
  isRecording,
  onStart,
  onClip,
}: Props) {
  return (
    <section className="mt-8 border border-white/10 bg-white/[0.03] p-5">
      <div className="text-xs tracking-[0.3em] text-white/40">
        VIDEO MEMORY
      </div>

      <div className="mt-5 flex gap-3">
        <button
          onClick={onStart}
          className={`rounded-xl px-5 py-4 font-black ${
            isRecording
              ? "bg-red-500/20 text-red-300"
              : "bg-white text-black"
          }`}
        >
          {isRecording ? "RECORDING" : "START RECORDING"}
        </button>

        <button
          onClick={onClip}
          disabled={!isRecording}
          className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-4 font-black text-cyan-300 disabled:opacity-30"
        >
          MARK CLIP
        </button>
      </div>
    </section>
  );
}