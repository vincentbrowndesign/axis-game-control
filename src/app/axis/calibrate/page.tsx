"use client";

import { useState } from "react";
import Link from "next/link";
import { AxisCaptureFrame } from "../../../components/axis/AxisCaptureFrame";
import { AxisLandmarkRequirementPanel } from "../../../components/axis/AxisLandmarkRequirementPanel";
import { AxisMeasurementPanel } from "../../../components/axis/AxisMeasurementPanel";
import { AxisRepTimeline, type AxisRep } from "../../../components/axis/AxisRepTimeline";
import { AxisProofCardPreview } from "../../../components/axis/AxisProofCardPreview";
import {
  axisCategoryLabels,
  axisTests,
  getTestsByCategory,
  type AxisTestCategory,
  type AxisTest,
} from "../../../lib/axis/tests";
import { buildLandmarkRequirements } from "../../../lib/axis/landmarks";
import { buildMeasurements } from "../../../lib/axis/measurements";

const categories: AxisTestCategory[] = ["jump", "landing", "lateral", "sprint", "decel", "shooting"];

export default function CalibratePage() {
  const [activeCategory, setActiveCategory] = useState<AxisTestCategory>("jump");
  const [activeTest, setActiveTest] = useState<AxisTest | null>(null);
  const [athleteName, setAthleteName] = useState<string | null>(null);
  const [reps, setReps] = useState<AxisRep[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [showAthleteInput, setShowAthleteInput] = useState(false);
  const [athleteInputValue, setAthleteInputValue] = useState("");

  const testsInCategory = getTestsByCategory(activeCategory);

  const landmarkRequirements = buildLandmarkRequirements(
    activeTest?.requiredLandmarks ?? [],
    activeTest?.optionalLandmarks ?? [],
  );

  const measurements = buildMeasurements(activeTest?.measurements ?? []);

  function handleCategorySelect(cat: AxisTestCategory) {
    setActiveCategory(cat);
    const first = axisTests.find((t) => t.category === cat) ?? null;
    setActiveTest(first);
  }

  function handleTestSelect(test: AxisTest) {
    setActiveTest(test);
    setReps([]);
    setSelectedRepId(null);
  }

  function handleRepSelect(repId: string) {
    setSelectedRepId(repId);
    setReps((prev) => prev.map((r) => ({ ...r, selected: r.id === repId })));
  }

  function handleRecordRep() {
    if (!activeTest) return;
    const rep: AxisRep = {
      id: crypto.randomUUID(),
      index: reps.length,
      timestampMs: Date.now(),
      selected: true,
    };
    setReps((prev) => [...prev.map((r) => ({ ...r, selected: false })), rep]);
    setSelectedRepId(rep.id);
  }

  function handleSaveAthlete() {
    const name = athleteInputValue.trim();
    if (!name) return;
    setAthleteName(name);
    setAthleteInputValue("");
    setShowAthleteInput(false);
  }

  const recordedAt = reps.length > 0
    ? new Date(reps[0].timestampMs).toLocaleDateString()
    : null;

  return (
    <div className="axis-calibrate-root">
      {/* Top bar */}
      <header className="axis-calibrate-topbar">
        <div className="axis-calibrate-topbar-left">
          <Link href="/" className="axis-calibrate-back">←</Link>
          <span className="axis-calibrate-brand">AXIS MEASURES</span>
        </div>

        <div className="axis-calibrate-topbar-center">
          {/* Athlete selector */}
          {showAthleteInput ? (
            <div className="axis-athlete-input-row">
              <input
                autoFocus
                className="axis-athlete-input"
                placeholder="Athlete name"
                value={athleteInputValue}
                onChange={(e) => setAthleteInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveAthlete()}
              />
              <button type="button" className="axis-btn axis-btn--sm" onClick={handleSaveAthlete}>Set</button>
              <button type="button" className="axis-btn axis-btn--sm axis-btn--ghost" onClick={() => setShowAthleteInput(false)}>Cancel</button>
            </div>
          ) : (
            <button
              type="button"
              className="axis-athlete-selector"
              onClick={() => setShowAthleteInput(true)}
            >
              {athleteName ?? "Select Athlete"}
            </button>
          )}

          {/* Test selector */}
          <select
            className="axis-test-selector"
            value={activeTest?.id ?? ""}
            onChange={(e) => {
              const t = axisTests.find((x) => x.id === e.target.value);
              if (t) handleTestSelect(t);
            }}
          >
            <option value="" disabled>Select Test</option>
            {categories.map((cat) => (
              <optgroup key={cat} label={axisCategoryLabels[cat]}>
                {axisTests.filter((t) => t.category === cat).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="axis-calibrate-topbar-right">
          <button
            type="button"
            className="axis-btn axis-btn--primary axis-btn--sm"
            disabled={reps.length === 0 || !activeTest}
          >
            Save Calibration
          </button>
        </div>
      </header>

      <div className="axis-calibrate-body">
        {/* Left rail — test categories */}
        <nav className="axis-calibrate-rail">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={cat === activeCategory ? "axis-rail-item axis-rail-item--active" : "axis-rail-item"}
              onClick={() => handleCategorySelect(cat)}
            >
              {axisCategoryLabels[cat]}
            </button>
          ))}

          <div className="axis-rail-divider" />

          {testsInCategory.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === activeTest?.id ? "axis-rail-sub axis-rail-sub--active" : "axis-rail-sub"}
              onClick={() => handleTestSelect(t)}
            >
              {t.name}
            </button>
          ))}
        </nav>

        {/* Center — camera + rep timeline */}
        <main className="axis-calibrate-main">
          <AxisCaptureFrame overlayActive={Boolean(activeTest)} />

          <div className="axis-calibrate-rep-controls">
            <button
              type="button"
              className="axis-btn axis-btn--primary"
              disabled={!activeTest}
              onClick={handleRecordRep}
            >
              Record Rep
            </button>
            {reps.length > 0 && (
              <button
                type="button"
                className="axis-btn axis-btn--ghost"
                onClick={() => { setReps([]); setSelectedRepId(null); }}
              >
                Clear Reps
              </button>
            )}
          </div>

          <AxisRepTimeline reps={reps} onSelect={handleRepSelect} />
        </main>

        {/* Right panel — landmarks + measurements */}
        <aside className="axis-calibrate-aside">
          <AxisLandmarkRequirementPanel
            requirements={landmarkRequirements}
            overallConfidence={null}
          />
          <AxisMeasurementPanel measurements={measurements} />
        </aside>
      </div>

      {/* Bottom — proof card */}
      <footer className="axis-calibrate-footer">
        <AxisProofCardPreview
          athleteName={athleteName}
          testName={activeTest?.name ?? null}
          measurements={measurements}
          repCount={reps.length}
          recordedAt={recordedAt}
        />
      </footer>
    </div>
  );
}
