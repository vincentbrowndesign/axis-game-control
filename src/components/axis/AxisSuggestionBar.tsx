export function AxisSuggestionBar({ suggestions }: { suggestions: string[] }) {
  return (
    <section className="axis-suggestions" aria-label="Suggested commands">
      {suggestions.map((suggestion) => (
        <button type="button" key={suggestion}>
          {suggestion}
        </button>
      ))}
    </section>
  );
}
