/* ============================================================
   AXIS evidence export — systemized file naming + camera roll.

   Web apps cannot write to the camera roll directly; the native
   share sheet ("Save to Photos" / "Save Image") is the route.
   Share first, auto-download (Downloads/Files) as the fallback.

   File names are the system: AXIS_{athlete}_{test}_{stamp}_{KIND}
   so evidence sorts by athlete and test wherever it lands.
============================================================ */

export type AxisEvidenceKind = "frame" | "rep";

export type AxisExportOutcome = "shared" | "downloaded" | "cancelled" | "failed";

export function axisEvidenceFileName(opts: {
  kind: AxisEvidenceKind;
  athlete: string | null;
  test: string | null;
  ext: string;
}): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = new Date();
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const athlete = (opts.athlete ?? "A00").replace(/\s+/g, "");
  const test = (opts.test ?? "OPEN").replace(/\s+/g, "-");
  return `AXIS_${athlete}_${test}_${stamp}_${opts.kind.toUpperCase()}.${opts.ext}`;
}

/* first container the device can actually record — Safari gives mp4,
   Chrome gives webm; both land in Photos/Google Photos fine */
export function pickAxisRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return null;
  for (const type of ["video/mp4", "video/webm;codecs=vp9", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

export function axisExtForMime(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "bin";
}

export async function exportAxisEvidenceFiles(files: File[]): Promise<AxisExportOutcome> {
  if (files.length === 0) return "failed";

  if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      /* share rejected for another reason — fall through to download */
    }
  }

  try {
    for (const file of files) downloadFile(file);
    return "downloaded";
  } catch {
    return "failed";
  }
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
