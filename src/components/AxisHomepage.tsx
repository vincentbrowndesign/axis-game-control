import Link from "next/link";

const overlaySteps = ["Choose Overlay", "Generate Overlay", "Preview", "Save Video"];
const videoTiles = ["Recent Video", "Overlay Draft", "Saved Replay"];
const overlayModes = ["Player Ring", "Ball Trail", "Pressure Pulse"];

export function AxisHomepage() {
  return (
    <main className="axis-simple-page">
      <header className="axis-simple-header">
        <Link href="/" aria-label="Axis home">
          AXIS
        </Link>
        <nav aria-label="Axis workspace">
          <a href="#videos">VIDEOS</a>
          <a href="#overlays">OVERLAYS</a>
          <a href="#archive">ARCHIVE</a>
        </nav>
      </header>

      <section className="axis-simple-hero" aria-labelledby="axis-simple-title">
        <div className="axis-simple-copy">
          <p>Camera roll to replay.</p>
          <h1 id="axis-simple-title">Create an overlay video fast.</h1>
          <Link className="axis-simple-upload" href="/capture">
            Upload Video
          </Link>
        </div>

        <div className="axis-simple-preview" aria-hidden="true">
          <span className="axis-simple-preview-label">Preview</span>
          <span className="axis-simple-player axis-simple-player-a">12</span>
          <span className="axis-simple-player axis-simple-player-b">8</span>
          <span className="axis-simple-player axis-simple-player-c">21</span>
          <span className="axis-simple-ball" />
          <span className="axis-simple-trail axis-simple-trail-a" />
          <span className="axis-simple-trail axis-simple-trail-b" />
          <span className="axis-simple-lane" />
          <span className="axis-simple-pulse" />
        </div>
      </section>

      <section className="axis-simple-actions" aria-label="Overlay workflow">
        {overlaySteps.map((step) => (
          <a href={step === "Choose Overlay" ? "#overlays" : "#videos"} key={step}>
            {step}
          </a>
        ))}
      </section>

      <section className="axis-simple-workspace" id="videos" aria-labelledby="axis-videos-title">
        <div className="axis-simple-section-title">
          <p>VIDEOS</p>
          <h2 id="axis-videos-title">Start with a clip.</h2>
        </div>
        <div className="axis-simple-video-grid">
          {videoTiles.map((tile) => (
            <article className="axis-simple-video-card" key={tile}>
              <div aria-hidden="true">
                <span className="axis-simple-video-dot" />
                <span className="axis-simple-video-line" />
              </div>
              <strong>{tile}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="axis-simple-workspace" id="overlays" aria-labelledby="axis-overlays-title">
        <div className="axis-simple-section-title">
          <p>OVERLAYS</p>
          <h2 id="axis-overlays-title">Pick the look.</h2>
        </div>
        <div className="axis-simple-overlay-grid">
          {overlayModes.map((mode) => (
            <article className="axis-simple-overlay-card" key={mode}>
              <div aria-hidden="true">
                <span className="axis-simple-overlay-ring" />
                <span className="axis-simple-overlay-ball" />
                <span className="axis-simple-overlay-trail" />
              </div>
              <strong>{mode}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="axis-simple-workspace axis-simple-archive" id="archive" aria-labelledby="axis-archive-title">
        <div className="axis-simple-section-title">
          <p>ARCHIVE</p>
          <h2 id="axis-archive-title">Keep finished videos close.</h2>
        </div>
        <Link className="axis-simple-save" href="/capture">
          Make Another Overlay
        </Link>
      </section>
    </main>
  );
}
