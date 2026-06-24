import Link from "next/link";
import type { Metadata } from "next";
import { getDatasetReadinessSummary } from "../../../../lib/axis/vision/dataset-readiness";
import { listAxisVisionDatasets } from "../../../../lib/axis/vision/dataset-registry";
import type { AxisVisionDataset, AxisVisionDatasetGroup, AxisVisionDatasetStatus } from "../../../../lib/axis/vision/types";

export const metadata: Metadata = {
  title: "Axis Lab / Datasets",
  robots: { follow: false, index: false },
};

const groups: AxisVisionDatasetGroup[] = [
  "Public Baselines",
  "Tracking / Pose",
  "Basketball-Specific Vision",
  "Axis Private Datasets",
  "Memory / Correction Datasets",
];

const filters = ["All", "Public", "Private", "Vision", "Tracking", "Pose", "Memory", "Ready", "Needs Work"] as const;
type DatasetFilter = (typeof filters)[number];

const readyStatuses: AxisVisionDatasetStatus[] = ["prepared", "trained", "tested", "active"];
const needsWorkStatuses: AxisVisionDatasetStatus[] = ["candidate", "raw", "sampled", "mapped"];

export default async function AxisLabDatasetsPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const activeFilter = normalizeFilter(params?.filter);
  const datasets = listAxisVisionDatasets().filter((dataset) => matchesFilter(dataset, activeFilter));

  return (
    <main className="axis-lab-datasets" aria-labelledby="axis-lab-datasets-title">
      <section className="axis-lab-datasets__hero">
        <p className="axis-lab-datasets__eyebrow">Axis Lab</p>
        <h1 id="axis-lab-datasets-title">Dataset Registry</h1>
        <p>
          Axis Lab is where datasets, model tests, and review tools live. The main product stays focused on capturing sessions and saving memory.
        </p>
      </section>

      <nav className="axis-lab-datasets__filters" aria-label="Dataset filters">
        {filters.map((filter) => {
          const href = filter === "All" ? "/axis/lab/datasets" : `/axis/lab/datasets?filter=${encodeURIComponent(filter.toLowerCase())}`;
          return (
            <Link aria-current={activeFilter === filter ? "page" : undefined} href={href} key={filter}>
              {filter}
            </Link>
          );
        })}
      </nav>

      <div className="axis-lab-datasets__groups">
        {groups.map((group) => {
          const groupDatasets = datasets.filter((dataset) => dataset.group === group);
          if (groupDatasets.length === 0) return null;

          return (
            <section className="axis-lab-datasets__group" aria-labelledby={`axis-dataset-group-${slug(group)}`} key={group}>
              <div className="axis-lab-datasets__group-heading">
                <h2 id={`axis-dataset-group-${slug(group)}`}>{group}</h2>
                <span>{groupDatasets.length}</span>
              </div>
              <div className="axis-lab-datasets__list">
                {groupDatasets.map((dataset) => (
                  <DatasetCard dataset={dataset} key={dataset.id} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <style>{`
        .axis-lab-datasets,
        .axis-lab-datasets * {
          box-sizing: border-box;
        }

        .axis-lab-datasets {
          min-height: 100dvh;
          padding: 32px 18px;
          background: #f7f4ef;
          color: #171717;
          font-family: var(--font-geist-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }

        .axis-lab-datasets__hero,
        .axis-lab-datasets__filters,
        .axis-lab-datasets__groups {
          width: min(1040px, 100%);
          margin: 0 auto;
        }

        .axis-lab-datasets__hero {
          padding: 20px 0 22px;
          border-bottom: 1px solid rgba(23, 23, 23, 0.14);
        }

        .axis-lab-datasets__eyebrow {
          margin: 0 0 8px;
          color: #5f6f52;
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .axis-lab-datasets h1,
        .axis-lab-datasets h2,
        .axis-lab-datasets h3,
        .axis-lab-datasets p {
          margin-top: 0;
        }

        .axis-lab-datasets h1 {
          margin-bottom: 12px;
          font-size: clamp(2rem, 8vw, 4.25rem);
          line-height: 0.96;
        }

        .axis-lab-datasets__hero p:last-child {
          max-width: 720px;
          margin-bottom: 0;
          color: #4a4a4a;
          font-size: 1rem;
          line-height: 1.55;
        }

        .axis-lab-datasets__filters {
          display: flex;
          gap: 8px;
          margin-top: 18px;
          overflow-x: auto;
          padding-bottom: 8px;
        }

        .axis-lab-datasets__filters a {
          flex: 0 0 auto;
          border: 1px solid rgba(23, 23, 23, 0.16);
          border-radius: 999px;
          color: #282828;
          font-size: 0.82rem;
          font-weight: 800;
          padding: 9px 12px;
          text-decoration: none;
        }

        .axis-lab-datasets__filters a[aria-current="page"] {
          background: #171717;
          color: #fffefa;
        }

        .axis-lab-datasets__groups {
          display: grid;
          gap: 28px;
          padding: 22px 0;
        }

        .axis-lab-datasets__group {
          display: grid;
          gap: 12px;
        }

        .axis-lab-datasets__group-heading {
          align-items: center;
          display: flex;
          gap: 12px;
          justify-content: space-between;
        }

        .axis-lab-datasets__group-heading h2 {
          margin-bottom: 0;
          font-size: 1.22rem;
          line-height: 1.1;
        }

        .axis-lab-datasets__group-heading span,
        .axis-lab-datasets__lab-badge {
          border: 1px solid rgba(95, 111, 82, 0.28);
          border-radius: 999px;
          color: #405734;
          font-size: 0.72rem;
          font-weight: 850;
          padding: 5px 8px;
          text-transform: uppercase;
        }

        .axis-lab-datasets__list {
          display: grid;
          gap: 14px;
        }

        .axis-lab-datasets__card {
          display: grid;
          gap: 14px;
          padding: 16px;
          border: 1px solid rgba(23, 23, 23, 0.14);
          border-radius: 8px;
          background: #fffefa;
        }

        .axis-lab-datasets__card-top {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          justify-content: space-between;
        }

        .axis-lab-datasets__card h3 {
          margin-bottom: 6px;
          font-size: 1.24rem;
          line-height: 1.14;
        }

        .axis-lab-datasets__card p {
          color: #464646;
          line-height: 1.45;
          margin-bottom: 0;
        }

        .axis-lab-datasets__chips,
        .axis-lab-datasets__meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .axis-lab-datasets__chips span,
        .axis-lab-datasets__meta span {
          border-radius: 999px;
          background: rgba(95, 111, 82, 0.1);
          color: #34482a;
          font-size: 0.76rem;
          font-weight: 800;
          padding: 6px 8px;
        }

        .axis-lab-datasets__meta span {
          background: rgba(23, 23, 23, 0.06);
          color: #333333;
        }

        .axis-lab-datasets__summary {
          border-top: 1px solid rgba(23, 23, 23, 0.1);
          color: #5a5a5a;
          font-size: 0.86rem;
          margin: 0;
          padding-top: 12px;
        }

        @media (min-width: 760px) {
          .axis-lab-datasets {
            padding: 48px 24px;
          }

          .axis-lab-datasets__list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </main>
  );
}

function DatasetCard({ dataset }: { dataset: AxisVisionDataset }) {
  const readiness = getDatasetReadinessSummary(dataset);

  return (
    <article className="axis-lab-datasets__card">
      <div className="axis-lab-datasets__card-top">
        <div>
          <p className="axis-lab-datasets__eyebrow">{dataset.group}</p>
          <h3>{dataset.name}</h3>
          <p>{dataset.purpose}</p>
        </div>
        <span className="axis-lab-datasets__lab-badge">Axis Lab</span>
      </div>

      <div className="axis-lab-datasets__chips" aria-label={`${dataset.name} useful for`}>
        {dataset.usefulFor.map((item) => <span key={item}>{item}</span>)}
      </div>

      <p>{dataset.axisUse}</p>

      <div className="axis-lab-datasets__meta" aria-label={`${dataset.name} dataset details`}>
        <span>{dataset.sourceType}</span>
        <span>{dataset.source}</span>
        <span>{dataset.status}</span>
        <span>{dataset.priority} priority</span>
      </div>

      <p className="axis-lab-datasets__summary">{readiness.meaning}</p>
    </article>
  );
}

function normalizeFilter(value: string | undefined): DatasetFilter {
  const match = filters.find((filter) => filter.toLowerCase() === value?.toLowerCase());
  return match ?? "All";
}

function matchesFilter(dataset: AxisVisionDataset, filter: DatasetFilter) {
  if (filter === "All") return true;
  if (filter === "Public") return dataset.sourceType === "public";
  if (filter === "Private") return dataset.sourceType === "private";
  if (filter === "Vision") return dataset.tags.includes("vision");
  if (filter === "Tracking") return dataset.tags.includes("tracking");
  if (filter === "Pose") return dataset.tags.includes("pose");
  if (filter === "Memory") return dataset.tags.includes("memory");
  if (filter === "Ready") return readyStatuses.includes(dataset.status);
  if (filter === "Needs Work") return needsWorkStatuses.includes(dataset.status);
  return true;
}

function slug(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/(^-|-$)/g, "");
}
