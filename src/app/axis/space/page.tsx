"use client";

import {
  axisCapabilities,
  axisCapabilityCategories,
  axisDatasets,
  axisLoops,
  axisProviders,
  type AxisCapability,
} from "../../../lib/axis/space/registry";

export default function AxisSpacePage() {
  const capabilitiesByCategory = axisCapabilityCategories.map((category) => ({
    category,
    capabilities: axisCapabilities.filter((capability) => capability.category === category),
  }));

  return (
    <main className="axis-space">
      <header className="axis-space__hero">
        <p>Axis Space</p>
        <h1>Capability Map</h1>
        <span>Static control room for what Axis can do, what data exists, which loops are active, and which providers may be used later.</span>
      </header>

      <section className="axis-space__section" aria-labelledby="axis-space-capabilities">
        <div className="axis-space__section-title">
          <p>1</p>
          <h2 id="axis-space-capabilities">Capabilities</h2>
        </div>
        <div className="axis-space__category-grid">
          {capabilitiesByCategory.map(({ capabilities, category }) => (
            <article className="axis-space__group" key={category}>
              <h3>{category}</h3>
              {capabilities.length === 0 ? (
                <p>No seeded capability yet.</p>
              ) : (
                capabilities.map((capability) => <CapabilityCard capability={capability} key={capability.id} />)
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="axis-space__section" aria-labelledby="axis-space-datasets">
        <div className="axis-space__section-title">
          <p>2</p>
          <h2 id="axis-space-datasets">Datasets</h2>
        </div>
        <div className="axis-space__grid">
          {axisDatasets.map((dataset) => (
            <article className="axis-space__item" key={dataset.id}>
              <small>{dataset.id}</small>
              <strong>{dataset.name}</strong>
              <span>{dataset.description}</span>
              <em data-status={dataset.status}>{dataset.status}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="axis-space__section" aria-labelledby="axis-space-loops">
        <div className="axis-space__section-title">
          <p>3</p>
          <h2 id="axis-space-loops">Loops</h2>
        </div>
        <div className="axis-space__loop-list">
          {axisLoops.map((loop) => (
            <article className="axis-space__loop" key={loop.id}>
              <div>
                <small>{loop.status}</small>
                <h3>{loop.name}</h3>
                <p>{loop.acceptance_test}</p>
              </div>
              <ol>
                <li><span>Input</span>{loop.input}</li>
                <li><span>Capability</span>{loop.capability}</li>
                <li><span>Provider</span>{loop.provider}</li>
                <li><span>Result</span>{loop.result}</li>
                <li><span>Dataset</span>{loop.dataset}</li>
                <li><span>Deliverable</span>{loop.deliverable}</li>
                <li><span>Review</span>{loop.review}</li>
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section className="axis-space__section" aria-labelledby="axis-space-providers">
        <div className="axis-space__section-title">
          <p>4</p>
          <h2 id="axis-space-providers">Providers</h2>
        </div>
        <div className="axis-space__grid">
          {axisProviders.map((provider) => (
            <article className="axis-space__item" key={provider.id}>
              <small>{provider.category} - {provider.type}</small>
              <strong>{provider.name}</strong>
              <span>{provider.description}</span>
              <span>Capabilities: {formatList(provider.capabilities)}</span>
              <em data-status={provider.status}>{provider.status}</em>
            </article>
          ))}
        </div>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

function CapabilityCard({ capability }: { capability: AxisCapability }) {
  return (
    <div className="axis-space__capability">
      <div>
        <small>{capability.id}</small>
        <strong>{capability.name}</strong>
      </div>
      <em data-status={capability.status}>{capability.status}</em>
      <p>{capability.description}</p>
      <dl>
        <div><dt>Inputs</dt><dd>{formatList(capability.inputs)}</dd></div>
        <div><dt>Outputs</dt><dd>{formatList(capability.outputs)}</dd></div>
        <div><dt>Datasets</dt><dd>{formatList(capability.datasets_created)}</dd></div>
        <div><dt>Providers</dt><dd>{formatList(capability.possible_providers)}</dd></div>
        <div><dt>First page</dt><dd>{capability.first_page}</dd></div>
        <div><dt>Acceptance</dt><dd>{capability.acceptance_test}</dd></div>
      </dl>
    </div>
  );
}

function formatList(values: string[]) {
  return values.length ? values.join(", ") : "none";
}

const styles = `
  .axis-space {
    background: #f5f2e9;
    color: #141610;
    min-height: 100dvh;
    padding: 1rem;
  }

  .axis-space__hero,
  .axis-space__section {
    margin: 0 auto;
    max-width: 76rem;
  }

  .axis-space__hero {
    display: grid;
    gap: 0.7rem;
    padding: 2rem 0 1.25rem;
  }

  .axis-space__hero p,
  .axis-space__section-title p,
  .axis-space small,
  .axis-space dt {
    color: rgba(20, 22, 16, 0.56);
    font-size: 0.72rem;
    font-weight: 850;
    letter-spacing: 0.1em;
    margin: 0;
    text-transform: uppercase;
  }

  .axis-space h1,
  .axis-space h2,
  .axis-space h3,
  .axis-space p {
    margin: 0;
  }

  .axis-space h1 {
    font-size: clamp(2.6rem, 12vw, 6.5rem);
    letter-spacing: 0;
    line-height: 0.92;
  }

  .axis-space__hero span {
    color: rgba(20, 22, 16, 0.68);
    max-width: 42rem;
  }

  .axis-space__section {
    display: grid;
    gap: 0.85rem;
    padding: 1.25rem 0;
  }

  .axis-space__section-title {
    align-items: end;
    border-top: 1px solid rgba(20, 22, 16, 0.16);
    display: flex;
    gap: 0.75rem;
    padding-top: 1rem;
  }

  .axis-space__section-title h2 {
    font-size: clamp(1.45rem, 5vw, 2.6rem);
    letter-spacing: 0;
  }

  .axis-space__category-grid,
  .axis-space__grid {
    display: grid;
    gap: 0.7rem;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  }

  .axis-space__group,
  .axis-space__item,
  .axis-space__loop {
    background: rgba(255, 255, 255, 0.62);
    border: 1px solid rgba(20, 22, 16, 0.13);
    border-radius: 0.5rem;
    display: grid;
    gap: 0.7rem;
    padding: 0.8rem;
  }

  .axis-space__group > p,
  .axis-space__loop p,
  .axis-space__item span,
  .axis-space__capability p,
  .axis-space dd {
    color: rgba(20, 22, 16, 0.68);
    font-size: 0.86rem;
  }

  .axis-space__capability {
    border-top: 1px solid rgba(20, 22, 16, 0.1);
    display: grid;
    gap: 0.55rem;
    padding-top: 0.7rem;
  }

  .axis-space__capability > div,
  .axis-space__item {
    align-content: start;
  }

  .axis-space__capability strong,
  .axis-space__item strong {
    display: block;
    font-size: 1rem;
  }

  .axis-space em {
    background: rgba(20, 22, 16, 0.08);
    border-radius: 999px;
    color: rgba(20, 22, 16, 0.72);
    font-size: 0.7rem;
    font-style: normal;
    font-weight: 850;
    justify-self: start;
    padding: 0.24rem 0.48rem;
    text-transform: uppercase;
  }

  .axis-space em[data-status="active"],
  .axis-space em[data-status="available"] {
    background: #161b12;
    color: #f5f2e9;
  }

  .axis-space dl {
    display: grid;
    gap: 0.38rem;
    margin: 0;
  }

  .axis-space dl div {
    display: grid;
    gap: 0.12rem;
  }

  .axis-space dd {
    margin: 0;
  }

  .axis-space__loop-list {
    display: grid;
    gap: 0.7rem;
  }

  .axis-space__loop ol {
    display: grid;
    gap: 0.45rem;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .axis-space__loop li {
    background: rgba(20, 22, 16, 0.06);
    border-radius: 0.45rem;
    display: grid;
    gap: 0.18rem;
    padding: 0.55rem;
  }

  .axis-space__loop li span {
    color: rgba(20, 22, 16, 0.5);
    font-size: 0.68rem;
    font-weight: 850;
    text-transform: uppercase;
  }

  @media (max-width: 640px) {
    .axis-space {
      padding: 0.85rem;
    }
  }
`;
