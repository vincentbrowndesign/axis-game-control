"use client";

import type { NapoleonCashLoop, NapoleonLoopArtifact } from "../../lib/napoleon/types";
import {
  labelNapoleonIncomeType,
  labelNapoleonWealthLayer,
  playerMemoryPassCheckoutWire,
  playerMemoryPassFulfillmentWire,
  playerMemoryPassLeakRule,
  playerMemoryPassOffer,
} from "../../lib/napoleon/seed";

type Props = {
  loop: NapoleonCashLoop;
  onBack: () => void;
  onAction: (artifact: NapoleonLoopArtifact, updates?: Partial<NapoleonCashLoop>) => void;
  onCreateLeakRule: () => void;
  onTestLeakRule: () => void;
};

const wordsOutput = [
  {
    title: "First social post",
    body: "Training should not disappear after the session. I am turning each workout into memory: recap, proof moments, development notes, and the next focus.",
  },
  {
    title: "Parent DM message",
    body: "Your player is putting in real work. I am building a Player Memory Pass so you can see what happened, what improved, and what we are carrying into the next session.",
  },
  {
    title: "Product page headline",
    body: "Training should not disappear after the session.",
  },
  {
    title: "CTA",
    body: "Get your player's memory pass.",
  },
];

export function NapoleonPlayerMemoryPassBuilder({
  loop,
  onAction,
  onBack,
  onCreateLeakRule,
  onTestLeakRule,
}: Props) {
  const offer = loop.offerBuilder ?? playerMemoryPassOffer;
  const checkoutWire = loop.checkoutWire ?? playerMemoryPassCheckoutWire;
  const fulfillmentWire = loop.fulfillmentWire ?? playerMemoryPassFulfillmentWire;
  const leakRule = loop.leakRuleConfig ?? playerMemoryPassLeakRule;

  return (
    <section className="napoleon-builder" aria-label="Player Memory Pass Loop Builder">
      <button className="napoleon-builder__back" type="button" onClick={onBack}>
        Back to Napoleon
      </button>

      <section className="napoleon-builder-card napoleon-builder-header">
        <span>Loop Builder</span>
        <h1>{loop.title}</h1>
        <dl>
          <div>
            <dt>Income Type</dt>
            <dd>{labelNapoleonIncomeType(loop.incomeType)}</dd>
          </div>
          <div>
            <dt>Wealth Layer</dt>
            <dd>{labelNapoleonWealthLayer(loop.wealthLayer)}</dd>
          </div>
          <div>
            <dt>System Blueprint</dt>
            <dd>{loop.systemBlueprint}</dd>
          </div>
          <div>
            <dt>Origin</dt>
            <dd>Basketball training / earned income</dd>
          </div>
          <div>
            <dt>Evolution</dt>
            <dd>Recurring proof subscription</dd>
          </div>
        </dl>
      </section>

      <section className="napoleon-builder-card">
        <BuilderHeading eyebrow="Offer Builder" title="Turn the recap layer into a product." />
        <dl>
          <BuilderRow label="Target customer" value={offer.targetCustomer} />
          <BuilderRow label="Core problem" value={offer.coreProblem} />
          <BuilderRow label="Offer" value={offer.offer} />
          <div>
            <dt>Suggested pricing</dt>
            <dd>
              {offer.pricing.map((tier) => (
                <span className="napoleon-price-pill" key={tier.label}>
                  {tier.label}: {tier.price}
                </span>
              ))}
            </dd>
          </div>
          <BuilderRow label="Fastest cash path" value={offer.fastestCashPath} />
          <BuilderRow label="Scalable cash path" value={offer.scalableCashPath} />
        </dl>
      </section>

      <section className="napoleon-builder-card">
        <BuilderHeading eyebrow="Checkout Wire" title="Create the payment path without pretending it is connected." />
        <div className="napoleon-wire-grid">
          {checkoutWire.connections.map((connection) => (
            <article className="napoleon-wire-card" key={connection.name}>
              <strong>{connection.name}</strong>
              <span>{connection.status}</span>
              <p>{connection.purpose}</p>
            </article>
          ))}
        </div>
        <div className="napoleon-builder-actions">
          <button type="button" onClick={() => onAction(createArtifact("stripe_link_placeholder"))}>
            Create Stripe Link Placeholder
          </button>
          <button type="button" onClick={() => onAction(createArtifact("shopify_product_draft"))}>
            Draft Shopify Product
          </button>
          <button type="button" onClick={() => onAction(createArtifact("landing_page_copy"))}>
            Draft Landing Page Copy
          </button>
        </div>
      </section>

      <section className="napoleon-builder-card">
        <BuilderHeading eyebrow="Fulfillment Wire" title="Name what the parent receives." />
        <p>Status: {labelFulfillmentStatus(fulfillmentWire.status)}</p>
        <ul>
          {fulfillmentWire.buyerReceives.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <button type="button" onClick={() => onAction(createArtifact("recap_template"), { fulfillmentWire: { ...fulfillmentWire, status: "draft" } })}>
          Create Recap Template
        </button>
      </section>

      <section className="napoleon-builder-card">
        <BuilderHeading eyebrow="Proof Rule" title="Targets are not current revenue." />
        <dl>
          <BuilderRow label="Proof metric" value="Active subscribers + monthly recurring revenue" />
          <BuilderRow label="First target" value="10 parents" />
          <BuilderRow label="Revenue range" value="$250-$750 MRR target scenario, not current revenue" />
        </dl>
      </section>

      <section className="napoleon-builder-card">
        <BuilderHeading eyebrow="Leak Rule" title="Protect the money path after every session." />
        <p>{leakRule.rule}</p>
        <p>Estimated leak: {leakRule.estimatedLeak}</p>
        <div className="napoleon-builder-actions">
          <button type="button" onClick={onCreateLeakRule}>
            Create Leak Rule
          </button>
          <button type="button" onClick={onTestLeakRule}>
            Test Leak Rule
          </button>
        </div>
      </section>

      <section className="napoleon-builder-card">
        <BuilderHeading eyebrow="Words Output" title="Clean proof-based selling language." />
        <div className="napoleon-copy-list">
          {wordsOutput.map((copy) => (
            <article key={copy.title}>
              <small>{copy.title}</small>
              <p>{copy.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="napoleon-builder-card">
        <BuilderHeading eyebrow="Build Actions" title="Make the loop actionable." />
        <div className="napoleon-builder-actions">
          <button type="button" onClick={() => onAction(createArtifact("stripe_link_placeholder"))}>
            Build Checkout Path
          </button>
          <button type="button" onClick={() => onAction(createArtifact("parent_offer"))}>
            Generate Parent Offer
          </button>
          <button type="button" onClick={() => onAction(createArtifact("proof_template"))}>
            Create Proof Template
          </button>
          <button type="button" onClick={onTestLeakRule}>
            Test Leak Rule
          </button>
        </div>
      </section>

      {loop.artifacts && loop.artifacts.length > 0 && (
        <section className="napoleon-builder-card">
          <BuilderHeading eyebrow="Structured Artifacts" title="Local drafts created from this loop." />
          <div className="napoleon-copy-list">
            {loop.artifacts.map((artifact) => (
              <article key={artifact.id}>
                <small>{artifact.type.replaceAll("_", " ")}</small>
                <strong>{artifact.title}</strong>
                <p>{artifact.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function BuilderHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="napoleon-builder-heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
    </div>
  );
}

function BuilderRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function createArtifact(type: NapoleonLoopArtifact["type"]): NapoleonLoopArtifact {
  const createdAt = new Date().toISOString();
  const copy: Record<NapoleonLoopArtifact["type"], { title: string; body: string }> = {
    stripe_link_placeholder: {
      title: "Stripe payment link placeholder",
      body: "Player Memory Pass payment link draft for $25, $50, and $75/month tiers. Not connected to Stripe yet.",
    },
    shopify_product_draft: {
      title: "Shopify product draft",
      body: "Product catalog draft for Player Memory Pass subscription. Shopify is future wiring.",
    },
    landing_page_copy: {
      title: "Landing page copy",
      body: "Training should not disappear after the session. Get your player's memory pass.",
    },
    parent_offer: {
      title: "Parent offer",
      body: "Monthly player memory with recap, proof moments, development notes, and next focus.",
    },
    proof_template: {
      title: "Proof template",
      body: "Session recap, 1-3 proof moments, player development note, next focus, and monthly progress summary.",
    },
    recap_template: {
      title: "Recap template",
      body: "What happened, what improved, what needs work, proof moments, and next focus.",
    },
    leak_test: {
      title: "Leak rule test",
      body: "Placeholder leak detected when a completed session has no recap or payment path within 15 minutes.",
    },
  };

  return {
    id: `${type}-${Date.now().toString(36)}`,
    type,
    title: copy[type].title,
    body: copy[type].body,
    createdAt,
  };
}

function labelFulfillmentStatus(status: string) {
  return status.replaceAll("_", " ");
}
