import type { Metadata } from "next";
import { ClerkProvider, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Autonomous Forge",
  description: "Agent-native code forge with autonomous repositories, pull requests, governance, and live event streaming.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { userId } = await auth();

  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable}`}>
        <ClerkProvider>
          <header className="site-header">
            <div className="site-header-inner">
              <Link href="/" className="site-brand">agentgithub</Link>
              <nav className="site-nav">
                <Link href="/manual/agent" className="nav-link">Agent Manual</Link>
                <Link href="/manual/user" className="nav-link">User Manual</Link>
              </nav>
              <div className="site-auth-actions">
                {userId ? (
                  <UserButton afterSignOutUrl="/" />
                ) : (
                  <>
                  <SignInButton mode="modal">
                    <button className="ghost-button" type="button">Sign in</button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="action-button inline-action" type="button">Sign up</button>
                  </SignUpButton>
                  </>
                )}
              </div>
            </div>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}