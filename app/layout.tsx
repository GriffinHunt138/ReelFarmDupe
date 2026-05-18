import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReelFarm — TikTok Slideshow Generator",
  description: "AI-powered viral TikTok photo slideshow creator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0a0a0a]">{children}</body>
    </html>
  );
}
