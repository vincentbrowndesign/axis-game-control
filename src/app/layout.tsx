import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Axis",
  description: "Upload video, add overlays, and save a replay.",
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
