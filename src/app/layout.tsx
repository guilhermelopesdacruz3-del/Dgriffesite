import type { Metadata } from "next";
// Fontes: serif (títulos) + sans (corpo) — definidas como variáveis CSS
// para o Tailwind usá-las em font-serif / font-sans.
import { Fraunces, Inter } from "next/font/google";
import { storeConfig } from "@/lib/config";
import { CookieConsent } from "@/components/lgpd/cookie-consent";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(storeConfig.siteUrl),
  title: {
    default: `${storeConfig.name} — Armações, óculos de sol e lentes`,
    template: `%s | ${storeConfig.name}`,
  },
  description: `${storeConfig.tagline} Frete grátis acima de R$ ${storeConfig.commerce.freeShippingAbove}, provador virtual 3D e troca em ${storeConfig.commerce.exchangeDays} dias.`,
  openGraph: {
    siteName: storeConfig.name,
    locale: "pt_BR",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${fraunces.variable} font-sans antialiased bg-white text-ink`}
      >
        {children}
        {/* LGPD (Fase 9): banner de consentimento — nada de rastreio antes da escolha */}
        <CookieConsent />
      </body>
    </html>
  );
}
