"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { readAthletes, saveAthlete, deleteAthlete, newAthleteProfile, positionLabels } from "../../../lib/axis/athlete-profile";
import type { AthleteProfile } from "../../../lib/axis/athlete-profile";

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<AthleteProfile[]>([]);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setAthletes(readAthletes());
  }, []);

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    const profile = newAthleteProfile(name);
    const next = saveAthlete(profile);
    setAthletes(next);
    setNewName("");
    setAdding(false);
  }

  function handleDelete(id: string) {
    const next = deleteAthlete(id);
    setAthletes(next);
  }

  return (
    <div className="axis-page">
      <header className="axis-page-header">
        <Link href="/axis/calibrate" className="axis-back">← Calibrate</Link>
        <h1>Athletes</h1>
        <button type="button" className="axis-btn axis-btn--primary axis-btn--sm" onClick={() => setAdding(true)}>
          Add Athlete
        </button>
      </header>

      {adding && (
        <div className="axis-add-athlete-row">
          <input
            autoFocus
            className="axis-athlete-input"
            placeholder="Athlete name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button type="button" className="axis-btn axis-btn--primary axis-btn--sm" onClick={handleAdd}>Save</button>
          <button type="button" className="axis-btn axis-btn--ghost axis-btn--sm" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      )}

      {athletes.length === 0 && !adding && (
        <p className="axis-empty">No athletes yet. Add one to start tracking baselines.</p>
      )}

      <ul className="axis-athlete-list">
        {athletes.map((a) => (
          <li key={a.id} className="axis-athlete-item">
            <div>
              <strong>{a.name}</strong>
              <span>{positionLabels[a.position]}</span>
              <span>{a.baselines.length} baseline{a.baselines.length !== 1 ? "s" : ""}</span>
            </div>
            <button
              type="button"
              className="axis-btn axis-btn--ghost axis-btn--sm"
              onClick={() => handleDelete(a.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
