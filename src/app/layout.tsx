import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Midheaven",
  description: "Midheaven turns real-life sources into a Money Map.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
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
