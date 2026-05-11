export async function captureSnapshot(file: File) {
  return URL.createObjectURL(file);
}