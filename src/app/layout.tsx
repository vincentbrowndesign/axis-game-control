import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Axis",
  description: "Upload basketball footage and bring important moments to life.",
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
