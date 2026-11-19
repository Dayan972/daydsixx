import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${BRAND_NAME} : créez votre boutique en ligne en conversant`, template: `%s · ${BRAND_NAME}` },
  description:
    "Créez votre boutique en ligne avec une IA, sans coder. Prix clairs en euros, crédits expliqués, export de vos données en un clic, conformité européenne incluse.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
