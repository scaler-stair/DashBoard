import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal Audit AI Dashboard",
  description: "AI-powered internal audit dashboard: upload quarterly audit PDFs, track observations, compare quarters, and ask the AI assistant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
