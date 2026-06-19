"use client";

import { useMemo, useState } from "react";
import { AXIS_ROOM_COLORS, AXIS_STATUS_STYLES } from "../../../lib/axis-visual-language";
import AxisBoardCanvas from "./axis-board-canvas";
import AxisCardInspector from "./axis-card-inspector";
import AxisComposer from "./axis-composer";
import {
  axisLabBoardCards,
  axisLabFocus,
  axisLabSessionStartedAt,
  axisLabThreadTitle,
  axisLabTimeline,
} from "./axis-lab-mock-data";
import AxisLabShell from "./axis-lab-shell";
import type { AxisLabSaveStatus, AxisLabTimelineEntry } from "./axis-lab-types";
import AxisSessionTimeline from "./axis-session-timeline";
import AxisThreadHeader from "./axis-thread-header";

export default function AxisLabPreview() {
  const [selectedCardId, setSelectedCardId] = useState(axisLabBoardCards[0]?.id ?? "");
  const [timeline, setTimeline] = useState<AxisLabTimelineEntry[]>(axisLabTimeline);
  const [saveStatus, setSaveStatus] = useState<AxisLabSaveStatus>("saved");

  const selectedCard = useMemo(
    () => axisLabBoardCards.find((card) => card.id === selectedCardId) ?? axisLabBoardCards[0] ?? null,
    [selectedCardId],
  );

  function appendPreviewMessage(text: string) {
    const timestamp = new Date().toISOString();
    setTimeline((current) => [
      ...current,
      {
        id: `local-${timestamp}`,
        kind: "user",
        label: "Preview user",
        text,
        timestamp,
      },
    ]);
    setSaveStatus("unsaved_changes");
  }

  function resetPreview() {
    setTimeline(axisLabTimeline);
    setSaveStatus("saved");
    setSelectedCardId(axisLabBoardCards[0]?.id ?? "");
  }

  return (
    <AxisLabShell
      colors={AXIS_ROOM_COLORS}
      statusStyles={AXIS_STATUS_STYLES}
      header={
        <AxisThreadHeader
          labLabel="Axis Lab / UI Preview"
          saveStatus={saveStatus}
          sessionStartedAt={axisLabSessionStartedAt}
          threadTitle={axisLabThreadTitle}
          onReset={resetPreview}
          onSaveStatusChange={setSaveStatus}
        />
      }
      timeline={<AxisSessionTimeline entries={timeline} />}
      board={
        <AxisBoardCanvas
          cards={axisLabBoardCards}
          focus={axisLabFocus}
          selectedCardId={selectedCard?.id ?? ""}
          onSelectCard={setSelectedCardId}
        />
      }
      inspector={<AxisCardInspector card={selectedCard} focus={axisLabFocus} />}
      composer={<AxisComposer onSubmit={appendPreviewMessage} />}
    />
  );
}
