export default function NapoleonPage() {
  return (
    <main
      style={{
        alignItems: "center",
        background: "#f8f7f2",
        color: "#111111",
        display: "flex",
        minHeight: "100dvh",
        padding: "24px",
      }}
    >
      <section
        style={{
          display: "grid",
          gap: "16px",
          margin: "0 auto",
          maxWidth: "680px",
          width: "100%",
        }}
      >
        <p
          style={{
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.18em",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          Powered by Axis
        </p>
        <h1
          style={{
            fontSize: "clamp(48px, 16vw, 120px)",
            letterSpacing: "-0.08em",
            lineHeight: 0.9,
            margin: 0,
          }}
        >
          NAPOLEON
        </h1>
        <p
          style={{
            fontSize: "clamp(24px, 7vw, 48px)",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            margin: 0,
            maxWidth: "620px",
          }}
        >
          What are we turning into money today?
        </p>
        <p
          style={{
            color: "#4c4c4c",
            fontSize: "16px",
            lineHeight: 1.5,
            margin: 0,
            maxWidth: "520px",
          }}
        >
          Napoleon MVP cleanup complete. Ready for query-first build.
        </p>
      </section>
    </main>
  );
}
