import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CaptionKit",
  description: "Subtitle generator and editor",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0f1a] text-white antialiased">{children}</body>
    </html>
  );
}