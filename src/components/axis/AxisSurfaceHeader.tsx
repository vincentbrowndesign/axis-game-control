"use client";

type Props = {
  eyebrow: string;
  title: string;
  body?: string;
};

export function AxisSurfaceHeader({ body, eyebrow, title }: Props) {
  return (
    <header className="axis-surface-header">
      <p>{eyebrow}</p>
      <h2>{title}</h2>
      {body && <span>{body}</span>}
    </header>
  );
}
