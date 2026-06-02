"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDatasetBins, type DatasetBin } from "../lib/clipnote-store";

export function ClipnoteStacks() {
  const [bins, setBins] = useState<DatasetBin[]>([]);

  useEffect(() => {
    setBins(getDatasetBins());
  }, []);

  return (
    <main className="cn-stacks-page">
      <nav className="cn-stacks-nav">
        <Link className="cn-back-btn" href="/">
          BACK
        </Link>
        <p className="cn-brand cn-stack-page-title">STACKS</p>
      </nav>

      {bins.length > 0 ? (
        <section className="cn-stacks-list">
          {bins.map((bin) => (
            <div className="cn-stack-card" key={bin.tag_id}>
              <span className="cn-stack-name">{bin.tag_name}</span>
              <span className="cn-stack-count">
                {bin.clipnote_count}{" "}
                {bin.clipnote_count === 1 ? "Clipnote" : "Clipnotes"}
              </span>
            </div>
          ))}
        </section>
      ) : (
        <p className="cn-empty-state">Save clipnotes with tags to build stacks.</p>
      )}
    </main>
  );
}
