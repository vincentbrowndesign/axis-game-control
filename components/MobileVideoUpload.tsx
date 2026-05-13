"use client";

import { useState } from "react";

type Props = {
  sessionId: string;
};

export default function MobileVideoUpload({
  sessionId,
}: Props) {
  const [uploading, setUploading] =
    useState(false);

  const [status, setStatus] =
    useState("");

  const [error, setError] =
    useState("");

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      setUploading(true);
      setError("");

      // CREATE UPLOAD
      setStatus("Creating upload...");

      const createRes = await fetch(
        "/api/mux/upload",
        {
          method: "POST",
        }
      );

      const createData =
        await createRes.json();

      if (!createData.success) {
        console.error(createData);

        throw new Error(
          createData.error ||
            "Upload creation failed"
        );
      }

      // DIRECT UPLOAD TO MUX
      setStatus("Uploading video...");

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
        throw new Error(
          "Direct upload failed"
        );
      }

      // WAIT BEFORE POLLING
      setStatus(
        "Processing video… this can take a few minutes on mobile."
      );

      let playbackId: string | null =
        null;

      // LONG MOBILE POLLING
      for (let i = 0; i < 180; i++) {
        await new Promise((r) =>
          setTimeout(r, 3000)
        );

        const pollRes = await fetch(
          `/api/mux/upload/${createData.uploadId}`
        );

        const pollData =
          await pollRes.json();

        console.log("POLL", pollData);

        if (pollData.playbackId) {
          playbackId =
            pollData.playbackId;
          break;
        }
      }

      if (!playbackId) {
        throw new Error(
          "Playback never became ready"
        );
      }

      setStatus("Ready");

      window.location.href =
        `/session/${sessionId}` +
        `?playbackId=${playbackId}`;
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Upload failed on mobile"
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="border border-white/10 bg-black/30 rounded-2xl p-5 text-center cursor-pointer text-white">
        <input
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          disabled={uploading}
          onChange={handleUpload}
        />

        <div className="font-medium">
          {uploading
            ? status
            : "Upload Game Video"}
        </div>
      </label>

      {error && (
        <div className="text-red-500 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}