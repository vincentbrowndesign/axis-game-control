"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MobileVideoUpload() {
  const router = useRouter();

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

      // STEP 1
      setStatus("CREATING UPLOAD");
      setProgress(10);

      const createRes = await fetch("/api/upload", {
        method: "POST",
      });

      if (!createRes.ok) {
        throw new Error("CREATE_UPLOAD_FAILED");
      }

      const createData = await createRes.json();

      console.log(createData);

      // STEP 2
      setStatus("UPLOADING");
      setProgress(30);

      const uploadRes = await fetch(
        createData.uploadUrl,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              file.type || "video/mp4",
          },
          body: file,
        }
      );

      if (!uploadRes.ok) {
        throw new Error("UPLOAD_FAILED");
      }

      // STEP 3
      setStatus("PROCESSING");
      setProgress(70);

      let sessionId = "";

      for (let i = 0; i < 90; i++) {
        await new Promise((resolve) =>
          setTimeout(resolve, 2000)
        );

        const pollRes = await fetch(
          `/api/mux/upload/${createData.uploadId}`
        );

        if (!pollRes.ok) continue;

        const pollData = await pollRes.json();

        console.log("POLL", pollData);

        if (pollData.status === "ready") {
          sessionId = pollData.sessionId;
          break;
        }
      }

      if (!sessionId) {
        throw new Error("PROCESSING_TIMEOUT");
      }

      // STEP 4
      setStatus("READY");
      setProgress(100);

      router.push(`/session/${sessionId}`);
    } catch (error) {
      console.error(error);

      setStatus("UPLOAD FAILED");
      setProgress(100);
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

        <div className="mt-12 space-y-6">
          {/* CHOOSE */}
          <label className="block cursor-pointer rounded-[32px] border border-white/10 bg-neutral-950 p-10">
            <div className="space-y-6">
              <p className="text-[34px] font-semibold tracking-[0.35em]">
                CHOOSE FILE
              </p>

              {fileName ? (
                <p className="break-all text-3xl">
                  {fileName}
                </p>
              ) : (
                <p className="text-xl text-white/40">
                  Choose existing clip.
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
          <label className="block cursor-pointer rounded-[32px] border border-white/10 bg-neutral-950 p-10">
            <div className="space-y-6">
              <p className="text-[34px] font-semibold tracking-[0.35em]">
                RECORD
              </p>

              <p className="text-xl text-white/40">
                Record from camera.
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

        {status && (
          <div className="mt-10">
            <div className="h-5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="mt-8 text-center">
              <p className="text-[48px] tracking-[0.35em] text-white/70">
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