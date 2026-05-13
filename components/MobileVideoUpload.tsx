"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MobileVideoUpload() {
  const router = useRouter();

  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");

  async function handleFile(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    try {
      const file = event.target.files?.[0];

      if (!file) return;

      setFileName(file.name);
      setUploading(true);
      setStatus("CREATING SESSION");
      setProgress(10);

      // CREATE SESSION
      const sessionRes = await fetch("/api/session", {
        method: "POST",
      });

      if (!sessionRes.ok) {
        throw new Error("Failed creating session");
      }

      const session = await sessionRes.json();

      setStatus("CREATING UPLOAD");
      setProgress(20);

      // CREATE MUX DIRECT UPLOAD
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.id,
        }),
      });

      if (!uploadRes.ok) {
        throw new Error("Failed creating upload");
      }

      const upload = await uploadRes.json();

      if (!upload.url) {
        throw new Error("Missing upload URL");
      }

      setStatus("UPLOADING");
      setProgress(40);

      // UPLOAD FILE TO MUX
      const muxUpload = await fetch(upload.url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!muxUpload.ok) {
        throw new Error("Upload failed");
      }

      setStatus("PROCESSING");
      setProgress(85);

      // WAIT FOR PLAYBACK ID
      let playbackId: string | null = null;

      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) =>
          setTimeout(resolve, 2000)
        );

        const pollRes = await fetch(
          `/api/upload/${session.id}`
        );

        if (!pollRes.ok) continue;

        const pollData = await pollRes.json();

        if (pollData.playback_id) {
          playbackId = pollData.playback_id;
          break;
        }
      }

      if (!playbackId) {
        throw new Error("Playback never became ready");
      }

      setStatus("READY");
      setProgress(100);

      router.push(`/session/${session.id}`);
    } catch (error) {
      console.error(error);

      setStatus("UPLOAD FAILED");
      setProgress(100);
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[72px] font-black leading-[0.9] tracking-[0.35em]">
          AXIS
          <br />
          SESSION
        </h1>

        <div className="mt-12 space-y-4">
          {/* CHOOSE CLIP */}
          <label className="flex cursor-pointer items-center justify-center rounded-[32px] border border-white/10 bg-neutral-950 px-8 py-12 active:scale-[0.99]">
            <div className="w-full">
              <p className="text-[28px] font-semibold tracking-[0.35em]">
                CHOOSE FILE
              </p>

              {fileName ? (
                <p className="mt-6 text-2xl text-white">
                  {fileName}
                </p>
              ) : (
                <p className="mt-6 text-xl text-white/40">
                  Choose an existing clip from your phone.
                </p>
              )}
            </div>

            <input
              type="file"
              accept="video/*"
              onChange={handleFile}
              className="hidden"
            />
          </label>

          {/* RECORD */}
          <label className="flex cursor-pointer items-center justify-center rounded-[32px] border border-white/10 bg-neutral-950 px-8 py-12 active:scale-[0.99]">
            <div className="w-full">
              <p className="text-[28px] font-semibold tracking-[0.35em]">
                RECORD
              </p>

              <p className="mt-6 text-xl text-white/40">
                Record live from camera.
              </p>
            </div>

            <input
              type="file"
              accept="video/*"
              capture="environment"
              onChange={handleFile}
              className="hidden"
            />
          </label>
        </div>

        {(uploading || status) && (
          <div className="mt-10">
            <div className="h-5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-white transition-all duration-500"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="mt-8 text-center">
              <p className="text-[42px] tracking-[0.4em] text-white/70">
                {status}
              </p>

              <p className="mt-4 text-2xl text-white/40">
                {progress}%
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}