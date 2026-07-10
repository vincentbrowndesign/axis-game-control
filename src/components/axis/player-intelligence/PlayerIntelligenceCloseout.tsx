"use client";

import { useMemo, useState } from "react";
import type { PlayerIntelligenceSession } from "../../../lib/axis/player-intelligence";
import {
  formatPlayerIntelligenceParentRecap,
  formatPlayerIntelligenceReport,
  getPrimaryProofMomentLines,
} from "../../../lib/axis/player-intelligence";
import { FormCard, IconMark } from "./PiKit";

export function PlayerIntelligenceCloseout({
  session,
  onMarkFollowUpOffered,
  onMarkReportSent,
}: {
  session: PlayerIntelligenceSession;
  onMarkFollowUpOffered: () => void;
  onMarkReportSent: () => void;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const parentRecap = useMemo(() => formatPlayerIntelligenceParentRecap(session), [session]);
  const reportCopy = useMemo(() => formatPlayerIntelligenceReport(session), [session]);
  const proofMoments = useMemo(() => getPrimaryProofMomentLines(session), [session]);

  return (
    <section className="pi-panel pi-closeout" aria-label="Session Closeout">
      <div className="pi-panel-head">
        <p>Session Closeout</p>
        <span>Parent recap + follow-up handoff</span>
      </div>

      {!session.permission.publicContentPermission ? (
        <div className="pi-privacy-note">
          <IconMark label="Private" />
          <span>Parent recap and report are private deliverables. Do not use clips or notes publicly unless permission is approved.</span>
        </div>
      ) : null}

      <div className="pi-closeout-grid">
        <FormCard title="Development Read">
          <CloseoutValue value={session.report.developmentRead} empty="Add this in Report Draft." />
        </FormCard>

        <FormCard title="Main Development Priority">
          <CloseoutValue value={session.report.developmentPriority} empty="Add this in Report Draft." />
        </FormCard>

        <FormCard title="Next Objective">
          <CloseoutValue value={session.report.nextObjective} empty="Add this in Report Draft." />
        </FormCard>

        <FormCard title="Recommended Development Plan">
          <CloseoutValue value={session.report.developmentPlanDirection} empty="Add this in Report Draft." />
        </FormCard>
      </div>

      <div className="pi-closeout-grid pi-closeout-grid--proof">
        <FormCard title="Three Proof Moments">
          <ol className="pi-closeout-proof">
            {proofMoments.map((moment, index) => (
              <li className={moment === "Add proof moment." ? "pi-empty" : undefined} key={`${moment}-${index}`}>
                {moment}
              </li>
            ))}
          </ol>
        </FormCard>

        <FormCard title="Follow-Up Offer">
          <CloseoutValue
            value={session.report.recommendedFollowUp || session.offer.offerName || session.offer.notes}
            empty="Add this in Follow-Up Offer."
          />
        </FormCard>
      </div>

      <div className="pi-closeout-actions">
        <button className="pi-button pi-button--primary" type="button" onClick={() => copyText("Parent recap", parentRecap)}>
          Copy Parent Recap
        </button>
        <button className="pi-button" type="button" onClick={() => copyText("Report", reportCopy)}>
          Copy Report
        </button>
        <button className={session.report.reportSent ? "pi-button pi-button--done" : "pi-button"} type="button" onClick={onMarkReportSent}>
          {session.report.reportSent ? "Report Sent" : "Mark Report Sent"}
        </button>
        <button className={session.offer.followUpOffered ? "pi-button pi-button--done" : "pi-button"} type="button" onClick={onMarkFollowUpOffered}>
          {session.offer.followUpOffered ? "Follow-Up Offered" : "Mark Follow-Up Offered"}
        </button>
      </div>

      {copyStatus ? <p className="pi-copy-status">{copyStatus}</p> : null}
    </section>
  );

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus(`${label} copy failed. Select the text from the report draft and copy manually.`);
    }
  }
}

function CloseoutValue({ empty, value }: { empty: string; value: string }) {
  const text = value.trim();
  return <p className={text ? "pi-closeout-value" : "pi-closeout-value pi-empty"}>{text || empty}</p>;
}
