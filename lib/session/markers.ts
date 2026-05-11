export function createMarker(label: string) {
  return {
    id: crypto.randomUUID(),
    label,
    createdAt: Date.now(),
  };
}