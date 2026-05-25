import type { Metadata, Viewport } from "next";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { getAxisSignInUrl, getAxisSignUpUrl } from "@/lib/axis-auth/authUrls";
import { hasValidClerkServerConfig } from "@/lib/axis-auth/clerkConfig";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Axis",
  description: "Live basketball memory, held in one continuous thread.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkEnabled = hasValidClerkServerConfig();
  const clerkPublishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const signInUrl = getAxisSignInUrl();
  const signUpUrl = getAxisSignUpUrl();

  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="axis-organism-root min-h-full flex flex-col">
        {clerkEnabled ? (
          <ClerkProvider
            publishableKey={clerkPublishableKey}
            signInUrl={signInUrl}
            signUpUrl={signUpUrl}
          >
            <header className="axis-auth-presence" aria-label="Axis account">
              <Show when="signed-out">
                <SignInButton mode="redirect">
                  <button className="axis-auth-action" type="button">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="redirect">
                  <button
                    className="axis-auth-action axis-auth-action-primary"
                    type="button"
                  >
                    Sign up
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </header>
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
