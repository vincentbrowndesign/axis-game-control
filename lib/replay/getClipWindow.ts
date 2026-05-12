interface ClipWindow {
  start: number;
  end: number;
}

export function getClipWindow(
  timestamp: number,
  totalDuration: number,
  paddingBefore = 8,
  paddingAfter = 8
): ClipWindow {
  const start = Math.max(0, timestamp - paddingBefore);

  const end = Math.min(
    totalDuration,
    timestamp + paddingAfter
  );

  return {
    start,
    end,
  };
}