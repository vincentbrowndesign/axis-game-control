import type { Metadata } from "next";
import "../styles/globals.css";
import "../styles/clipnote.css";

export const metadata: Metadata = {
  title: "Clipnote",
  description: "Flag. Clip. Save.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
