"use client";

import type { PlayerIntelligenceSession } from "../../../lib/axis/player-intelligence";
import { getFirstTenSlots } from "../../../lib/axis/player-intelligence";

export function FirstTenTracker({
  sessions,
  onLessonChange,
}: {
  sessions: PlayerIntelligenceSession[];
  onLessonChange: (sessionId: string, lesson: string) => void;
}) {
  const slots = getFirstTenSlots(sessions);

  return (
    <section className="pi-panel">
      <div className="pi-panel-head">
        <p>First 10 Player Intelligence Sessions</p>
        <span>Derived from local session records</span>
      </div>
      <div className="pi-table-wrap">
        <table className="pi-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Player</th>
              <th>Date</th>
              <th>Paid</th>
              <th>Session Type</th>
              <th>Main Goal</th>
              <th>Proof Clips</th>
              <th>Report Sent</th>
              <th>Next Objective</th>
              <th>Follow-Up Offered</th>
              <th>Follow-Up Sold</th>
              <th>Lesson</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => {
              const session = slot.session;
              return (
                <tr key={slot.number}>
                  <td>{slot.number}</td>
                  <td>{session?.intake.playerName || "Open"}</td>
                  <td>{session ? new Date(session.createdAt).toLocaleDateString() : ""}</td>
                  <td className="pi-table-check">{session?.debrief.paidAmount ? "Yes" : ""}</td>
                  <td>{session?.offer.offerType ?? ""}</td>
                  <td>{session?.intake.mainReason ?? ""}</td>
                  <td>{session ? String(session.proofMoments.filter((moment) => moment.whatHappened.trim()).length) : ""}</td>
                  <td className="pi-table-check">{session?.report.reportSent ? "Yes" : ""}</td>
                  <td>{session?.report.nextObjective ?? ""}</td>
                  <td className="pi-table-check">{session?.offer.followUpOffered ? "Yes" : ""}</td>
                  <td className="pi-table-check">{session?.offer.followUpSold ? "Yes" : ""}</td>
                  <td>
                    {session ? (
                      <input
                        className="pi-table-input"
                        value={session.debrief.lesson}
                        onChange={(event) => onLessonChange(session.id, event.target.value)}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
