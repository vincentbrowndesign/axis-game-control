import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Axis Mission Control",
  description: "Objective, constraint, progress, memory, and the next mission.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script defer data-domain="ontheaxis.com" src="https://plausible.io/js/script.js" />
        <script async src="https://plausible.io/js/pa-NihgHMwxkzRdgi9Hyz2sg.js" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
