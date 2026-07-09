"use client";

import type {
  DebriefState,
  IntakeState,
  OfferState,
  PermissionState,
  PlayerIntelligenceSession,
  ProofMoment,
  ReportState,
} from "../../../lib/axis/player-intelligence";
import {
  calculateChecklistCompleteness,
  calculateDebriefCompleteness,
  calculateIntakeCompleteness,
  calculateOfferCompleteness,
  calculateProofCompleteness,
  calculateReportCompleteness,
  calculateSessionCompleteness,
  createProofMoment,
  formatPlayerIntelligenceReport,
  getNextFirstTenSessionNumber,
} from "../../../lib/axis/player-intelligence";
import { captureChecklist } from "./PlayerIntelligenceData";
import { Field, FormCard, IconMark, Meter, Switch } from "./PiKit";

export function SessionWorkflow({
  sessions,
  activeSession,
  onCreateSession,
  onSelectSession,
  onUpdateSession,
}: {
  sessions: PlayerIntelligenceSession[];
  activeSession: PlayerIntelligenceSession | null;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onUpdateSession: (sessionId: string, updater: (session: PlayerIntelligenceSession) => PlayerIntelligenceSession) => void;
}) {
  if (!activeSession) {
    return (
      <section className="pi-panel">
        <div className="pi-panel-head">
          <p>Player Intelligence Session</p>
          <span>No local session open</span>
        </div>
        <p className="pi-copy">
          Start the first local session record. This stays on the operator device until the backend persistence build.
        </p>
        <button className="pi-button pi-button--primary" type="button" onClick={onCreateSession}>
          Start First 10 slot #{getNextFirstTenSessionNumber(sessions) ?? "extra"}
        </button>
      </section>
    );
  }

  const sessionCompletion = calculateSessionCompleteness(activeSession, captureChecklist);
  const reportText = formatPlayerIntelligenceReport(activeSession);
  const activeSessionId = activeSession.id;

  return (
    <>
      <section className="pi-panel">
        <div className="pi-panel-head">
          <p>Live Session Control</p>
          <Meter {...sessionCompletion} />
        </div>
        <div className="pi-grid pi-grid--sessions">
          {sessions.map((session) => (
            <article className={session.id === activeSession.id ? "pi-session-card pi-session-card--on" : "pi-session-card"} key={session.id}>
              <strong>{session.intake.playerName || `First 10 #${session.sessionNumber ?? "extra"}`}</strong>
              <span className="pi-muted">
                {session.status} · {new Date(session.createdAt).toLocaleDateString()}
              </span>
              <button className="pi-button" disabled={session.id === activeSession.id} type="button" onClick={() => onSelectSession(session.id)}>
                Open
              </button>
            </article>
          ))}
        </div>
        <div className="pi-row-actions">
          <button className="pi-button pi-button--primary" type="button" onClick={onCreateSession}>
            Start First 10 slot #{getNextFirstTenSessionNumber(sessions) ?? "extra"}
          </button>
          <button
            className="pi-button"
            type="button"
            onClick={() => update((session) => ({ ...session, status: session.status === "complete" ? "open" : "complete" }))}
          >
            Mark {activeSession.status === "complete" ? "open" : "complete"}
          </button>
        </div>
      </section>

      <StageHeader title="Intake" completion={calculateIntakeCompleteness(activeSession.intake)} />
      <section className="pi-grid pi-grid--two">
        <FormCard title="Player Intake" meta="Private operator notes">
          <Field label="Player name" value={activeSession.intake.playerName} onChange={(value) => setIntakeField("playerName", value)} />
          <Field label="Age" value={activeSession.intake.age} onChange={(value) => setIntakeField("age", value)} />
          <Field label="Graduation year" value={activeSession.intake.graduationYear} onChange={(value) => setIntakeField("graduationYear", value)} />
          <Field label="Team / school" value={activeSession.intake.teamSchool} onChange={(value) => setIntakeField("teamSchool", value)} />
          <Field label="Position or role" value={activeSession.intake.positionRole} onChange={(value) => setIntakeField("positionRole", value)} />
          <Field label="Parent goal" textarea value={activeSession.intake.parentGoal} onChange={(value) => setIntakeField("parentGoal", value)} />
          <Field label="Player goal" textarea value={activeSession.intake.playerGoal} onChange={(value) => setIntakeField("playerGoal", value)} />
          <Field label="Coach concern if provided" textarea value={activeSession.intake.coachConcern} onChange={(value) => setIntakeField("coachConcern", value)} />
          <Field label="Current strength" value={activeSession.intake.currentStrength} onChange={(value) => setIntakeField("currentStrength", value)} />
          <Field label="Current struggle" value={activeSession.intake.currentStruggle} onChange={(value) => setIntakeField("currentStruggle", value)} />
          <Field
            label="Movement context if voluntarily provided"
            textarea
            value={activeSession.intake.movementContext}
            onChange={(value) => setIntakeField("movementContext", value)}
          />
          <Field label="Main reason for booking" textarea value={activeSession.intake.mainReason} onChange={(value) => setIntakeField("mainReason", value)} />
        </FormCard>

        <FormCard title="Permission" meta="Private first">
          <Switch checked={activeSession.permission.recordingPermission} label="Recording permission" onChange={(value) => setPermissionField("recordingPermission", value)} />
          <Switch
            checked={activeSession.permission.privateProofClipPermission}
            label="Private proof clip permission"
            onChange={(value) => setPermissionField("privateProofClipPermission", value)}
          />
          <Switch
            checked={activeSession.permission.privateReportPermission}
            label="Private report permission"
            onChange={(value) => setPermissionField("privateReportPermission", value)}
          />
          <Field label="Approved recipients" value={activeSession.permission.approvedRecipients} onChange={(value) => setPermissionField("approvedRecipients", value)} />
          <Switch
            checked={activeSession.permission.publicContentPermission}
            label="Public content permission"
            onChange={(value) => setPermissionField("publicContentPermission", value)}
          />
          <Switch checked={activeSession.permission.marketingPermission} label="Marketing permission" onChange={(value) => setPermissionField("marketingPermission", value)} />
          <Field label="Naming/tagging restrictions" textarea value={activeSession.permission.namingRestrictions} onChange={(value) => setPermissionField("namingRestrictions", value)} />
          <Field label="School/team mention restrictions" textarea value={activeSession.permission.schoolRestrictions} onChange={(value) => setPermissionField("schoolRestrictions", value)} />
          <Field label="Parent restrictions" textarea value={activeSession.permission.parentRestrictions} onChange={(value) => setPermissionField("parentRestrictions", value)} />
        </FormCard>
      </section>

      <StageHeader title="Capture Checklist" completion={calculateChecklistCompleteness(activeSession.checklist, captureChecklist)} />
      <section className="pi-panel">
        {!activeSession.permission.recordingPermission ? (
          <div className="pi-banner">Confirm recording permission before capture. Minor-athlete proof stays private unless permission is explicit.</div>
        ) : null}
        <div className="pi-checklist">
          {captureChecklist.map((item) => (
            <label className={activeSession.checklist[item] ? "pi-check pi-check--on" : "pi-check"} key={item}>
              <input checked={Boolean(activeSession.checklist[item])} onChange={(event) => setChecklistItem(item, event.target.checked)} type="checkbox" />
              <IconMark label="OK" />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </section>

      <StageHeader title="Proof Moments" completion={calculateProofCompleteness(activeSession.proofMoments)} />
      <section className="pi-panel">
        <div className="pi-panel-head">
          <p>Proof Clips</p>
          <span>Minimum 3 clear proof moments</span>
        </div>
        <div className="pi-grid pi-grid--proof">
          {activeSession.proofMoments.map((moment, index) => (
            <FormCard key={moment.id} title={moment.category || `Proof ${index + 1}`}>
              <Field label="Time" value={moment.time} onChange={(value) => setProofMoment(index, "time", value)} />
              <Field label="Category" value={moment.category} onChange={(value) => setProofMoment(index, "category", value)} />
              <Field label="What happened" textarea value={moment.whatHappened} onChange={(value) => setProofMoment(index, "whatHappened", value)} />
              <Field label="Why it matters" textarea value={moment.whyItMatters} onChange={(value) => setProofMoment(index, "whyItMatters", value)} />
              <Field
                label="Possible next objective"
                textarea
                value={moment.possibleNextObjective}
                onChange={(value) => setProofMoment(index, "possibleNextObjective", value)}
              />
              <Field label="Follow-up idea" textarea value={moment.followUpIdea} onChange={(value) => setProofMoment(index, "followUpIdea", value)} />
            </FormCard>
          ))}
        </div>
        <button className="pi-button" type="button" onClick={() => update((session) => ({ ...session, proofMoments: [...session.proofMoments, createProofMoment("Additional proof")] }))}>
          Add proof moment
        </button>
      </section>

      <StageHeader title="Report Draft" completion={calculateReportCompleteness(activeSession.report)} />
      <section className="pi-grid pi-grid--two">
        <FormCard title="Player Intelligence Report">
          <Field label="Main strength" textarea value={activeSession.report.mainStrength} onChange={(value) => setReportField("mainStrength", value)} />
          <Field
            label="Development priority"
            textarea
            value={activeSession.report.developmentPriority}
            onChange={(value) => setReportField("developmentPriority", value)}
          />
          <Field label="Development read" textarea value={activeSession.report.developmentRead} onChange={(value) => setReportField("developmentRead", value)} />
          <Field label="Proof clips" textarea value={activeSession.report.proofClips} onChange={(value) => setReportField("proofClips", value)} />
          <Field label="Next objective" textarea value={activeSession.report.nextObjective} onChange={(value) => setReportField("nextObjective", value)} />
          <Field
            label="Development plan direction"
            textarea
            value={activeSession.report.developmentPlanDirection}
            onChange={(value) => setReportField("developmentPlanDirection", value)}
          />
          <Field
            label="Recommended follow-up"
            textarea
            value={activeSession.report.recommendedFollowUp}
            onChange={(value) => setReportField("recommendedFollowUp", value)}
          />
          <Switch checked={activeSession.report.reportSent} label="Report sent" onChange={(value) => setReportField("reportSent", value)} />
        </FormCard>

        <FormCard title="Formatted Report" meta="Copy or print">
          <textarea className="pi-report-output" readOnly value={reportText} />
          <button className="pi-button" type="button" onClick={() => navigator.clipboard.writeText(reportText)}>
            Copy report
          </button>
          <button className="pi-button" type="button" onClick={() => window.print()}>
            Print report
          </button>
        </FormCard>
      </section>

      <StageHeader title="Follow-Up + Debrief" completion={calculateOfferCompleteness(activeSession.offer)} />
      <section className="pi-grid pi-grid--two">
        <FormCard title="Follow-Up Offer">
          <Field label="Offer name" value={activeSession.offer.offerName} onChange={(value) => setOfferField("offerName", value)} />
          <Field label="Offer type" value={activeSession.offer.offerType} onChange={(value) => setOfferField("offerType", value)} />
          <Field label="Price" value={activeSession.offer.price} onChange={(value) => setOfferField("price", value)} />
          <Field label="Status" value={activeSession.offer.status} onChange={(value) => setOfferField("status", value)} />
          <Field label="Notes" textarea value={activeSession.offer.notes} onChange={(value) => setOfferField("notes", value)} />
          <Switch checked={activeSession.offer.followUpOffered} label="Follow-up offered" onChange={(value) => setOfferField("followUpOffered", value)} />
          <Switch checked={activeSession.offer.followUpSold} label="Follow-up sold" onChange={(value) => setOfferField("followUpSold", value)} />
        </FormCard>

        <FormCard title="Revenue Note + Debrief" meta={`${calculateDebriefCompleteness(activeSession.debrief).percent}%`}>
          <Field label="Paid amount" value={activeSession.debrief.paidAmount} onChange={(value) => setDebriefField("paidAmount", value)} />
          <Field label="Parent feedback" textarea value={activeSession.debrief.parentFeedback} onChange={(value) => setDebriefField("parentFeedback", value)} />
          <Field label="What created trust" textarea value={activeSession.debrief.whatCreatedTrust} onChange={(value) => setDebriefField("whatCreatedTrust", value)} />
          <Field label="What confused" textarea value={activeSession.debrief.whatConfused} onChange={(value) => setDebriefField("whatConfused", value)} />
          <Field label="Best proof clip" textarea value={activeSession.debrief.bestProofClip} onChange={(value) => setDebriefField("bestProofClip", value)} />
          <Field label="Lesson" textarea value={activeSession.debrief.lesson} onChange={(value) => setDebriefField("lesson", value)} />
          <Field label="Axis improvement" textarea value={activeSession.debrief.axisImprovement} onChange={(value) => setDebriefField("axisImprovement", value)} />
        </FormCard>
      </section>
    </>
  );

  function update(updater: (session: PlayerIntelligenceSession) => PlayerIntelligenceSession) {
    onUpdateSession(activeSessionId, (session) => ({ ...updater(session), updatedAt: new Date().toISOString() }));
  }

  function setIntakeField<Key extends keyof IntakeState>(key: Key, value: IntakeState[Key]) {
    update((session) => ({ ...session, intake: { ...session.intake, [key]: value } }));
  }

  function setPermissionField<Key extends keyof PermissionState>(key: Key, value: PermissionState[Key]) {
    update((session) => ({ ...session, permission: { ...session.permission, [key]: value } }));
  }

  function setChecklistItem(item: string, value: boolean) {
    update((session) => ({ ...session, checklist: { ...session.checklist, [item]: value } }));
  }

  function setProofMoment<Key extends keyof ProofMoment>(index: number, key: Key, value: ProofMoment[Key]) {
    update((session) => ({
      ...session,
      proofMoments: session.proofMoments.map((moment, itemIndex) => (itemIndex === index ? { ...moment, [key]: value } : moment)),
    }));
  }

  function setReportField<Key extends keyof (ReportState & { reportSent: boolean })>(key: Key, value: (ReportState & { reportSent: boolean })[Key]) {
    update((session) => ({ ...session, report: { ...session.report, [key]: value } }));
  }

  function setOfferField<Key extends keyof (OfferState & { followUpOffered: boolean; followUpSold: boolean })>(
    key: Key,
    value: (OfferState & { followUpOffered: boolean; followUpSold: boolean })[Key],
  ) {
    update((session) => ({ ...session, offer: { ...session.offer, [key]: value } }));
  }

  function setDebriefField<Key extends keyof DebriefState>(key: Key, value: DebriefState[Key]) {
    update((session) => ({ ...session, debrief: { ...session.debrief, [key]: value } }));
  }
}

function StageHeader({ title, completion }: { title: string; completion: { done: number; total: number; percent: number } }) {
  return (
    <section className="pi-panel">
      <div className="pi-panel-head">
        <p>{title}</p>
        <Meter {...completion} />
      </div>
    </section>
  );
}
