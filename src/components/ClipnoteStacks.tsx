"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStacks, type Stack } from "../lib/clipnote-store";

export function ClipnoteStacks() {
  const [stacks, setStacks] = useState<Stack[]>([]);

  useEffect(() => {
    setStacks(getStacks());
  }, []);

  return (
    <main className="cn-stacks-page">
      <nav className="cn-stacks-nav">
        <Link className="cn-back-btn" href="/">
          BACK
        </Link>
        <p className="cn-brand cn-stack-page-title">STACKS</p>
      </nav>

      {stacks.length > 0 ? (
        <section className="cn-stacks-list">
          {stacks.map((stack) => (
            <div className="cn-stack-card" key={stack.tag_id}>
              <span className="cn-stack-name">{stack.tag_name}</span>
              <span className="cn-stack-count">
                {stack.count} {stack.count === 1 ? "clipnote" : "clipnotes"}
              </span>
              <span className="cn-stack-progress">{Math.min(stack.count, 10)} / 10 dataset progress</span>
            </div>
          ))}
        </section>
      ) : (
        <p className="cn-empty-state">Save clipnotes with tags to build stacks.</p>
      )}
    </main>
  );
}
