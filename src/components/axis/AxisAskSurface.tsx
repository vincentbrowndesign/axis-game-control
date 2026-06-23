"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { AxisMemorySession } from "./AxisShell";
import { AxisSurfaceHeader } from "./AxisSurfaceHeader";

type Props = {
  sessions: AxisMemorySession[];
};

const suggestedQuestions = [
  "What did we keep missing?",
  "What should we work on next?",
  "Show recent finishing notes.",
  "What needs review?",
];

export function AxisAskSurface({ sessions }: Props) {
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");

  const answer = useMemo(() => {
    if (!submittedQuestion) {
      return sessions.length > 0
        ? "Ask about a player, focus, recent moment, or what should carry into the next session."
        : "No memory yet. Start a session first.";
    }

    if (sessions.length === 0) return "No memory yet. Start a session first.";

    return answerFromMemory(submittedQuestion, sessions);
  }, [sessions, submittedQuestion]);

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    setSubmittedQuestion(trimmed);
  }

  function askSuggestedQuestion(nextQuestion: string) {
    setQuestion(nextQuestion);
    setSubmittedQuestion(nextQuestion);
  }

  return (
    <section className="axis-surface">
      <AxisSurfaceHeader
        eyebrow="Ask Axis"
        title="Search your session memory."
        body="Ask from what you have captured so far. Typed and tapped moments count."
      />

      <form className="axis-ask-form" onSubmit={submitQuestion}>
        <label>
          Ask Axis
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What should we work on next?"
          />
        </label>
        <button className="axis-primary" type="submit" disabled={!question.trim()}>
          Ask
        </button>
      </form>

      <div className="axis-suggestion-list" aria-label="Suggested questions">
        {suggestedQuestions.map((suggestion) => (
          <button key={suggestion} type="button" onClick={() => askSuggestedQuestion(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      <article className="axis-answer-card" aria-live="polite">
        <small>{submittedQuestion ? "Axis" : "Ready"}</small>
        <strong>{submittedQuestion || "Ask from memory."}</strong>
        <span>{answer}</span>
      </article>
    </section>
  );
}

function answerFromMemory(question: string, sessions: AxisMemorySession[]) {
  const normalized = question.toLowerCase();
  const matchingSessions = findMatchingSessions(normalized, sessions);
  const sourceSessions = matchingSessions.length > 0 ? matchingSessions : sessions.slice(0, 3);
  const momentCount = sourceSessions.reduce((total, session) => total + session.moments.length, 0);
  const nextFocus = sourceSessions.find((session) => session.nextFocus)?.nextFocus;

  if (normalized.includes("next") || normalized.includes("work on")) {
    return nextFocus
      ? `Start with this carryover: ${nextFocus}`
      : "The next useful move is to capture one more session moment before deciding the carryover.";
  }

  if (normalized.includes("missing") || normalized.includes("review")) {
    const needsReview = sourceSessions
      .flatMap((session) => session.moments)
      .filter((moment) => moment.needsReview || moment.reviewState !== "correct")
      .slice(0, 3);

    if (needsReview.length > 0) {
      return `Review these first: ${needsReview.map((moment) => moment.interpretedTitle).join("; ")}.`;
    }

    return "Nothing is marked as unresolved yet. Add or refine a moment when the next session starts.";
  }

  if (normalized.includes("finishing") || normalized.includes("finish")) {
    const finishingMoments = sourceSessions
      .flatMap((session) => session.moments)
      .filter((moment) => `${moment.content} ${moment.interpretedTitle}`.toLowerCase().includes("finish"))
      .slice(0, 3);

    if (finishingMoments.length > 0) {
      return `Finishing notes: ${finishingMoments.map((moment) => moment.interpretedTitle).join("; ")}.`;
    }
  }

  return `${sourceSessions.length} recent session${sourceSessions.length === 1 ? "" : "s"} found with ${momentCount} moment${momentCount === 1 ? "" : "s"}. ${nextFocus ? `Carryover: ${nextFocus}` : "Capture one more moment to make the carryover sharper."}`;
}

function findMatchingSessions(question: string, sessions: AxisMemorySession[]) {
  const terms = question
    .split(/\s+/)
    .map((term) => term.replace(/[^a-z0-9]/g, ""))
    .filter((term) => term.length > 2);

  if (terms.length === 0) return [];

  return sessions.filter((session) => {
    const haystack = [
      session.title,
      session.playerName,
      session.objective,
      session.nextFocus,
      ...session.moments.flatMap((moment) => [
        moment.content,
        moment.interpretedTitle,
        moment.structure.situation,
        moment.structure.actor,
        moment.structure.action,
        moment.structure.outcome,
        moment.structure.cause,
        moment.structure.correction,
        moment.structure.evidence,
      ]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return terms.some((term) => haystack.includes(term));
  });
}
