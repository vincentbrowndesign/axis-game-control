"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  AxisAccessLink,
  AxisEventContainer,
  AxisMoment,
  AxisReport,
} from "../../../../../lib/axis-event-container";

function formatClock(totalSeconds: number) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function toLines(items: string[]) {
  return items.join("\n");
}

function fromLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AxisEventReportPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const [event, setEvent] = useState<AxisEventContainer | null>(null);
  const [moments, setMoments] = useState<AxisMoment[]>([]);
  const [report, setReport] = useState<AxisReport | null>(null);
  const [links, setLinks] = useState<AxisAccessLink[]>([]);
  const [summary, setSummary] = useState("");
  const [strengths, setStrengths] = useState("");
  const [corrections, setCorrections] = useState("");
  const [nextFocus, setNextFocus] = useState("");
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPrice, setLinkPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/axis/events/${eventId}`).catch(() => null);
      if (cancelled) return;
      if (!response?.ok) {
        setError("Could not load this event.");
        return;
      }
      const body = (await response.json()) as {
        accessLinks: AxisAccessLink[];
        event: AxisEventContainer;
        moments: AxisMoment[];
        reports: AxisReport[];
      };
      if (cancelled) return;
      setEvent(body.event);
      setMoments(body.moments);
      setLinks(body.accessLinks);
      const existing = body.reports[0] ?? null;
      setReport(existing);
      if (existing) {
        setSummary(existing.summary ?? "");
        setStrengths(toLines(existing.strengths ?? []));
        setCorrections(toLines(existing.corrections ?? []));
        setNextFocus(existing.next_focus ?? "");
        setEvidenceIds((existing.evidence ?? []).map((item) => item.moment_id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function saveReport() {
    if (busy) return;
    setBusy(true);
    setSaved(false);
    const response = await fetch(`/api/axis/events/${eventId}/report`, {
      body: JSON.stringify({
        corrections: fromLines(corrections),
        evidence: evidenceIds.map((momentId) => ({ moment_id: momentId })),
        next_focus: nextFocus,
        report_id: report?.id ?? null,
        strengths: fromLines(strengths),
        summary,
        title: event ? `${event.title} report` : "Axis report",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError("Could not save the report.");
      return;
    }
    const body = (await response.json()) as { report: AxisReport };
    setReport(body.report);
    setSaved(true);
    setError(null);
  }

  async function addLink() {
    if (!linkLabel.trim() || !linkUrl.trim() || busy) return;
    setBusy(true);
    const cents = Math.round(Number.parseFloat(linkPrice) * 100);
    const response = await fetch("/api/axis/access-links", {
      body: JSON.stringify({
        event_id: eventId,
        label: linkLabel,
        price_cents: Number.isFinite(cents) && cents >= 0 ? cents : null,
        report_id: report?.id ?? null,
        target_type: report ? "report" : "event",
        url: linkUrl,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError("Could not save the access link.");
      return;
    }
    const body = (await response.json()) as { accessLink: AxisAccessLink };
    setLinks((current) => [...current, body.accessLink]);
    setLinkLabel("");
    setLinkUrl("");
    setLinkPrice("");
  }

  return (
    <main className="axis-os">
      <header className="axis-os-topbar">
        <Link href={`/axis/events/${eventId}`}>{event?.title ?? "Event"}</Link>
        <span>Report</span>
      </header>

      <section className="axis-os-form">
        <label className="axis-os-field">
          <span>Summary</span>
          <textarea
            onChange={(input) => setSummary(input.target.value)}
            placeholder="What this event produced"
            rows={3}
            value={summary}
          />
        </label>

        <label className="axis-os-field">
          <span>Strengths (one per line)</span>
          <textarea
            onChange={(input) => setStrengths(input.target.value)}
            placeholder={"Pull-up footwork held under pressure"}
            rows={3}
            value={strengths}
          />
        </label>

        <label className="axis-os-field">
          <span>Corrections (one per line)</span>
          <textarea
            onChange={(input) => setCorrections(input.target.value)}
            placeholder={"Landing drifts right on closeouts"}
            rows={3}
            value={corrections}
          />
        </label>

        <label className="axis-os-field">
          <span>Next focus</span>
          <input
            onChange={(input) => setNextFocus(input.target.value)}
            placeholder="Two-foot landings this week"
            value={nextFocus}
          />
        </label>

        <div className="axis-os-field">
          <span>Evidence moments</span>
          <div className="axis-os-chiprow">
            {!moments.length && <p className="axis-os-empty">No moments to attach yet.</p>}
            {moments.map((moment) => (
              <button
                className={evidenceIds.includes(moment.id) ? "axis-os-chip axis-os-chip--on" : "axis-os-chip"}
                key={moment.id}
                onClick={() =>
                  setEvidenceIds((current) =>
                    current.includes(moment.id)
                      ? current.filter((momentId) => momentId !== moment.id)
                      : [...current, moment.id],
                  )
                }
                type="button"
              >
                {moment.ui_label} {formatClock(moment.timestamp_seconds)}
              </button>
            ))}
          </div>
        </div>

        <button className="axis-os-primary" disabled={busy} onClick={saveReport} type="button">
          {report ? "Save Report" : "Create Report"}
        </button>
        {saved && <p className="axis-os-empty">Report saved.</p>}
      </section>

      <section className="axis-os-list" aria-label="Access links">
        <h2>Access</h2>
        {links.map((link) => (
          <a className="axis-os-row" href={link.url} key={link.id} rel="noreferrer" target="_blank">
            <strong>{link.label}</strong>
            <span>
              {link.target_type}
              {typeof link.price_cents === "number" ? ` · $${(link.price_cents / 100).toFixed(2)}` : ""}
            </span>
          </a>
        ))}
        <div className="axis-os-inline">
          <input onChange={(input) => setLinkLabel(input.target.value)} placeholder="Link label" value={linkLabel} />
          <input onChange={(input) => setLinkUrl(input.target.value)} placeholder="Payment or access URL" value={linkUrl} />
          <input
            inputMode="decimal"
            onChange={(input) => setLinkPrice(input.target.value)}
            placeholder="Price (optional)"
            value={linkPrice}
          />
          <button disabled={!linkLabel.trim() || !linkUrl.trim() || busy} onClick={addLink} type="button">
            Attach Link
          </button>
        </div>
      </section>

      {error && <p className="axis-os-error">{error}</p>}
    </main>
  );
}
