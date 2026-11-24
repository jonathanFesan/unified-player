import type { Metadata, Viewport } from "next";
import { Nunito, Poppins } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

// Fonte arredondada e pesada, no mesmo espírito do nome "UPlayed" na logo.
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
// Fonte geométrica do nome "UPlayed" na logo (usada no nome e nos títulos).
const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-poppins", display: "swap" });

export const metadata: Metadata = {
  title: "UPlayed",
  description: "Player de música unificado — Spotify + YouTube em uma única fila.",
};

export const viewport: Viewport = {
  themeColor: "#0b1126",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`dark ${nunito.variable} ${poppins.variable}`}>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
