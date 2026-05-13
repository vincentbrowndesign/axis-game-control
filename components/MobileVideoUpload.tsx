"use client";

import { useRef, useState } from "react";

export default function MobileVideoUpload() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("SELECT CLIP");
  const [progress, setProgress] = useState(0);

  async function handleFile(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      setUploading(true);
      setStatus("CREATING UPLOAD");

      const createRes = await fetch("/api/upload", {
        method: "POST",
      });

      if (!createRes.ok) {
        setStatus("FAILED CREATING UPLOAD");
        setUploading(false);
        return;
      }

      const uploadData = await createRes.json();

      const uploadUrl = uploadData.url;
      const uploadId = uploadData.id;

      setStatus("UPLOADING");

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;

        const percent = Math.round(
          (event.loaded / event.total) * 100
        );

        setProgress(percent);
      });

      xhr.addEventListener("load", async () => {
        if (xhr.status !== 200 && xhr.status !== 201) {
          setStatus("UPLOAD FAILED");
          setUploading(false);
          return;
        }

        setStatus("PROCESSING");

        const sessionRes = await fetch("/api/mux/upload/" + uploadId);

        if (!sessionRes.ok) {
          setStatus("SESSION FAILED");
          setUploading(false);
          return;
        }

        const sessionData = await sessionRes.json();

        setStatus("COMPLETE");

        if (sessionData?.session_id) {
          window.location.href =
            "/session/" + sessionData.session_id;
        }
      });

      xhr.addEventListener("error", () => {
        setStatus("UPLOAD FAILED");
        setUploading(false);
      });

      xhr.open("PUT", uploadUrl);

      xhr.setRequestHeader(
        "Content-Type",
        file.type || "video/quicktime"
      );

      xhr.send(file);
    } catch (err) {
      console.error(err);
      setStatus("ERROR");
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="mx-auto max-w-md">
        <h1 className="text-[72px] leading-[0.9] font-black tracking-[0.25em]">
          AXIS
          <br />
          SESSION
        </h1>

        <div className="mt-12">
          <label className="relative block overflow-hidden rounded-[32px] border border-white/10 bg-neutral-950 p-10">
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              capture="environment"
              onChange={handleFile}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            />

            <div>
              <p className="text-[28px] font-semibold tracking-[0.35em]">
                CHOOSE OR
                <br />
                RECORD
              </p>

              <p className="mt-6 text-xl text-white/40">
                Select existing clip or record live
              </p>
            </div>
          </label>
        </div>

        <div className="mt-8 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-white transition-all duration-300"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className="mt-6">
          <p className="text-center text-[24px] tracking-[0.35em] text-white/70">
            {status}
          </p>
        </div>

        {uploading && (
          <div className="mt-4 text-center text-white/40">
            {progress}%
          </div>
        )}
      </div>
    </main>
  );
}