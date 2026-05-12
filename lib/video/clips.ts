export function createClipWindow(timestamp: number) {
  return {
    startTime: Math.max(timestamp - 5000, 0),
    endTime: timestamp + 5000,
  };
}