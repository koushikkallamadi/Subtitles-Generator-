import "./globals.css";
import type { Metadata } from "next";
import { Inter, Noto_Sans_Devanagari, Noto_Sans_Telugu, Poppins } from "next/font/google";
import AuthProvider from "../components/AuthProvider";
import { BRAND } from "../lib/brand";

const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-poppins", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const notoTelugu = Noto_Sans_Telugu({ subsets: ["telugu"], weight: ["400", "500", "700", "800"], variable: "--font-noto-telugu", display: "swap" });
const notoDevanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "500", "700", "800"], variable: "--font-noto-devanagari", display: "swap" });

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.description,
  openGraph: { title: BRAND.name, description: BRAND.description, siteName: BRAND.name, url: `https://${BRAND.domain}`, type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} ${inter.variable} ${notoTelugu.variable} ${notoDevanagari.variable} bg-[#0b0f1a] text-white antialiased`}><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
