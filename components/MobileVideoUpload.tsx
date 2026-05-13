"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MobileVideoUpload() {
  const router = useRouter();

  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);

  async function handleFile(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      setUploading(true);
      setStatus("CREATING UPLOAD");
      setProgress(10);

      // create mux upload
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
      });

      const uploadData = await uploadRes.json();

      if (!uploadData.url) {
        setStatus("FAILED CREATING UPLOAD");
        setUploading(false);
        return;
      }

      setStatus("UPLOADING VIDEO");
      setProgress(30);

      // upload to mux
      await fetch(uploadData.url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      setProgress(80);
      setStatus("PROCESSING VIDEO");

      // wait briefly for mux processing
      await new Promise((resolve) =>
        setTimeout(resolve, 4000)
      );

      setProgress(100);
      setStatus("OPENING SESSION");

      router.push(`/session/${uploadData.session_id}`);
    } catch (error) {
      console.error(error);

      setStatus("UPLOAD FAILED");
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl">
        <h1 className="text-[72px] leading-[0.9] font-black tracking-[0.3em]">
          AXIS
          <br />
          SESSION
        </h1>

        <div className="mt-16">
          <label className="block">
            <input
              type="file"
              accept="video/*"
              onChange={handleFile}
              className="hidden"
            />

            <div className="border border-white/10 rounded-[28px] p-8 cursor-pointer active:scale-[0.99] transition">
              <p className="text-2xl tracking-[0.3em]">
                CHOOSE OR RECORD
              </p>

              <p className="mt-4 text-white/40">
                Select existing clip or record live
              </p>
            </div>
          </label>
        </div>

        {uploading && (
          <div className="mt-10">
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-500"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <p className="mt-6 text-center text-3xl tracking-[0.3em] text-white/50">
              {status}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}