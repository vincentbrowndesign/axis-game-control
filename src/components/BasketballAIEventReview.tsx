"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type BasketballAIEventCandidate,
  type BasketballClip,
  type BasketballReviewedEvent,
  type BasketballSession,
} from "@/lib/basketball";

type ReviewStatus = "idle" | "loading" | "saving" | "error";

export function BasketballAIEventReview({
  session,
}: {
  session: BasketballSession | null;
}) {
  const [candidates, setCandidates] = useState<BasketballAIEventCandidate[]>([]);
  const [reviewedEvents, setReviewedEvents] = useState<BasketballReviewedEvent[]>([]);
  const [clips, setClips] = useState<BasketballClip[]>([]);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<ReviewStatus>("idle");
  const [error, setError] = useState("");

  const loadCandidates = useCallback(async () => {
    if (!session) {
      setCandidates([]);
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const response = await fetch(
        `/api/basketball/ai/events/${session.id}?userId=${session.userId}`,
      );
      const data = (await response.json()) as {
        suggestedMoments?: BasketballAIEventCandidate[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Could not load suggested moments.");
      }

      setCandidates(data.suggestedMoments || []);
      setStatus("idle");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Could not load suggested moments.");
    }
  }, [session]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCandidates();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadCandidates]);

  const reviewCandidate = async (
    candidate: BasketballAIEventCandidate,
    action: "approve" | "reject" | "correct",
  ) => {
    if (!session) return;

    setStatus("saving");
    setError("");

    try {
      const response = await fetch(`/api/basketball/ai/events/${candidate.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.userId,
          action,
          correctedEventType: corrections[candidate.id],
          candidate,
        }),
      });
      const data = (await response.json()) as {
        reviewedEvent?: BasketballReviewedEvent;
        status?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Review could not save.");
      }

      setCandidates((current) =>
        current.map((item) =>
          item.id === candidate.id
            ? {
                ...item,
                reviewStatus:
                  action === "reject" ? "rejected" : action === "correct" ? "corrected" : "approved",
              }
            : item,
        ),
      );

      if (data.reviewedEvent) {
        setReviewedEvents((current) => [data.reviewedEvent as BasketballReviewedEvent, ...current]);
      }

      setStatus("idle");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Review could not save.");
    }
  };

  const createClip = async (reviewedEvent: BasketballReviewedEvent) => {
    if (!session) return;

    setStatus("saving");
    setError("");

    try {
      const response = await fetch("/api/basketball/clips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.userId,
          reviewedEvent,
        }),
      });
      const data = (await response.json()) as { clip?: BasketballClip; error?: string };

      if (!response.ok || !data.clip) {
        throw new Error(data.error || "Clip could not be created.");
      }

      setClips((current) => [data.clip as BasketballClip, ...current]);
      setStatus("idle");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Clip could not be created.");
    }
  };

  return (
    <section className="basketball-card event-review-card">
      <div className="section-title">
        <span>5</span>
        <h2>AI Review</h2>
      </div>

      <p className="calibration-note">Axis suggests moments first. Coach reviews truth.</p>

      {!session ? (
        <p className="calibration-note">Start a session to review suggested moments.</p>
      ) : null}

      {session && !candidates.length && status !== "loading" ? (
        <p className="calibration-note">
          No suggested moments yet. Requires recording analysis later.
        </p>
      ) : null}

      {status === "loading" ? <p className="calibration-note">Loading suggested moments...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="candidate-list">
        {candidates.map((candidate) => (
          <article key={candidate.id} className="candidate-card">
            <div className="candidate-head">
              <strong>{candidate.eventType}</strong>
              <span>{formatTimestamp(candidate.startTimeSeconds)}</span>
            </div>

            <div className="candidate-meta">
              <span>Confidence {formatConfidence(candidate.confidence)}</span>
              <span>{formatReviewStatus(candidate.reviewStatus)}</span>
            </div>

            <p>{candidate.reason || "Suggested moment needs coach review."}</p>

            <dl>
              <div>
                <dt>Overlay setup</dt>
                <dd>{summarizeObject(candidate.overlayContext)}</dd>
              </div>
              <div>
                <dt>Evidence summary</dt>
                <dd>{summarizeObject(candidate.evidence)}</dd>
              </div>
            </dl>

            <label className="correction-field">
              Correct label
              <input
                value={corrections[candidate.id] || ""}
                onChange={(event) =>
                  setCorrections((current) => ({
                    ...current,
                    [candidate.id]: event.target.value,
                  }))
                }
                placeholder={formatMomentType(candidate.eventType)}
              />
            </label>

            <div className="review-actions">
              <button
                type="button"
                onClick={() => void reviewCandidate(candidate, "approve")}
                disabled={status === "saving" || candidate.reviewStatus !== "pending"}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => void reviewCandidate(candidate, "reject")}
                disabled={status === "saving" || candidate.reviewStatus !== "pending"}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => void reviewCandidate(candidate, "correct")}
                disabled={
                  status === "saving" ||
                  candidate.reviewStatus !== "pending" ||
                  !corrections[candidate.id]?.trim()
                }
              >
                Correct
              </button>
            </div>
          </article>
        ))}
      </div>

      {reviewedEvents.length ? (
        <div className="reviewed-list">
          <strong>Reviewed</strong>
          {reviewedEvents.slice(0, 3).map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => void createClip(event)}
              disabled={status === "saving"}
            >
              Create clip: {formatMomentType(event.eventType)}
            </button>
          ))}
        </div>
      ) : null}

      {clips.length ? (
        <div className="clip-list">
          <strong>Clips</strong>
          {clips.slice(0, 3).map((clip) => (
            <span key={clip.id}>
              {formatMomentType(clip.title)} {formatTimestamp(clip.startTimeSeconds)}-
              {formatTimestamp(clip.endTimeSeconds)}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function formatTimestamp(seconds?: number) {
  if (typeof seconds !== "number") return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatConfidence(confidence?: number) {
  if (typeof confidence !== "number") return "low";
  return `${Math.round(confidence * 100)}%`;
}

function formatReviewStatus(status: BasketballAIEventCandidate["reviewStatus"]) {
  if (status === "pending") return "Needs review";
  if (status === "approved") return "Approved";
  if (status === "corrected") return "Corrected";
  return "Rejected";
}

function formatMomentType(value: string) {
  return value.replaceAll("_", " ");
}

function summarizeObject(value: Record<string, unknown>) {
  const keys = Object.keys(value || {});
  if (!keys.length) return "No structured evidence.";
  return keys.slice(0, 4).join(", ");
}
