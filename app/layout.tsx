import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const geist = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "PaperReader — Read research papers without the friction",
  description:
    "Upload a research paper PDF, get clean inline-citation-free reading, and explore its citation network.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="font-sans antialiased bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
