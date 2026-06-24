import type { NapoleonProof } from "../../lib/napoleon/types";

type Props = {
  proof: NapoleonProof[];
};

export function NapoleonProofFeed({ proof }: Props) {
  return (
    <section className="napoleon-proof-feed">
      <div className="napoleon-section-heading">
        <span>Proof Feed</span>
        <h2>Proof without fake live revenue.</h2>
      </div>
      <div className="napoleon-proof-list">
        {proof.map((item) => (
          <article className="napoleon-proof-item" key={item.id}>
            <small>{item.type}</small>
            <strong>{item.text}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
