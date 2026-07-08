"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AxisOsNotice,
  AxisOsScreenState,
  AxisOsSection,
  formatAxisClock,
} from "../../../../../components/axis/AxisOsKit";
import { AxisSuiteShell } from "../../../../../components/axis/AxisSuiteShell";
import type {
  AxisAccessLink,
  AxisEventContainer,
  AxisMoment,
  AxisReport,
} from "../../../../../lib/axis-event-container";

const MARK_LABELS: Record<string, string> = { FIX: "Teach", KEEP: "Save" };

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
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error" | "offline">("loading");
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
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/axis/events/${eventId}`).catch(() => null);
      if (cancelled) return;
      if (!response || response.status === 503) {
        setLoadState("offline");
        return;
      }
      if (!response.ok) {
        setLoadState("error");
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        accessLinks: AxisAccessLink[];
        event: AxisEventContainer;
        moments: AxisMoment[];
        reports: AxisReport[];
      } | null;
      if (cancelled) return;
      if (!body?.event) {
        setLoadState("error");
        return;
      }
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
      setLoadState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    };
  }, []);

  async function saveReport() {
    if (busy) return;
    setBusy(true);
    setSaved(false);
    setError(null);
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
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 2500);
  }

  async function addLink() {
    if (!linkLabel.trim() || !linkUrl.trim() || busy) return;
    setBusy(true);
    setError(null);
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

  if (!event) {
    return (
      <AxisOsScreenState
        backHref={`/axis/events/${eventId}`}
        title="Report"
        tone={loadState === "loading" ? "loading" : loadState === "offline" ? "offline" : "error"}
      >
        {loadState === "loading" && "Loading package…"}
        {loadState === "offline" && "Session memory is offline right now."}
        {loadState === "error" && "Could not load this session."}
      </AxisOsScreenState>
    );
  }

  return (
    <AxisSuiteShell
      backHref={`/axis/events/${eventId}`}
      backLabel={event.title}
      title="Package"
      right={saved ? <span className="axis-os-savedchip">Saved</span> : undefined}
    >
      <section className="axis-os-hint">
        <p>Package this session for the people who need it — then share, sell, or send.</p>
      </section>

      <AxisOsSection label="Package" title="The package">
        <div className="axis-os-form axis-os-form--flush">
          <label className="axis-os-field">
            <span>Parent recap</span>
            <textarea
              onChange={(input) => setSummary(input.target.value)}
              placeholder="What happened in this session, in plain words"
              rows={3}
              value={summary}
            />
          </label>

          <label className="axis-os-field">
            <span>Player strengths (one per line)</span>
            <textarea
              onChange={(input) => setStrengths(input.target.value)}
              placeholder={"Pull-up footwork held under pressure"}
              rows={3}
              value={strengths}
            />
          </label>

          <label className="axis-os-field">
            <span>Teaching points (one per line)</span>
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
            <span>Moments to include</span>
            {!moments.length && <AxisOsNotice tone="empty">No moments to include yet.</AxisOsNotice>}
            <div className="axis-os-chiprow">
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
                  {MARK_LABELS[moment.ui_label]} {formatAxisClock(moment.timestamp_seconds)}
                </button>
              ))}
            </div>
          </div>

          <button className="axis-os-primary" disabled={busy} onClick={saveReport} type="button">
            {busy ? "Saving…" : "Save Package"}
          </button>
        </div>
      </AxisOsSection>

      <AxisOsSection label="Share" title="Share / Sell / Send">
        {!links.length && <AxisOsNotice tone="empty">Nothing shared yet. Add a link below.</AxisOsNotice>}
        {links.map((link) => (
          <a className="axis-os-row" href={link.url} key={link.id} rel="noreferrer" target="_blank">
            <div className="axis-os-row-main">
              <strong>{link.label}</strong>
              <span>Shared</span>
            </div>
            {typeof link.price_cents === "number" && (
              <em className="axis-os-row-go">${(link.price_cents / 100).toFixed(2)}</em>
            )}
          </a>
        ))}
        <div className="axis-os-inline">
          <input
            onChange={(input) => setLinkLabel(input.target.value)}
            placeholder="What are you sharing?"
            value={linkLabel}
          />
          <input onChange={(input) => setLinkUrl(input.target.value)} placeholder="Link" value={linkUrl} />
          <input
            inputMode="decimal"
            onChange={(input) => setLinkPrice(input.target.value)}
            placeholder="Price (optional)"
            value={linkPrice}
          />
          <button disabled={!linkLabel.trim() || !linkUrl.trim() || busy} onClick={addLink} type="button">
            Share
          </button>
        </div>
      </AxisOsSection>

      {error && <AxisOsNotice tone="error">{error}</AxisOsNotice>}

      <footer className="axis-os-livefooter">
        <Link href={`/axis/events/${eventId}`}>Done · Back to Session</Link>
      </footer>
    </AxisSuiteShell>
  );
}
