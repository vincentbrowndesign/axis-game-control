export function AxisTopbar() {
  return (
    <header className="axis-topbar">
      <div>
        <p>Axis</p>
        <h1>Universal command surface</h1>
      </div>
      <div className="axis-topbar__status" aria-label="Thread save status">
        <span aria-hidden="true" />
        <strong>Local draft</strong>
        <small>Not saved</small>
      </div>
    </header>
  );
}
