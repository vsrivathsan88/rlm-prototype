import type { Metadata } from "next";
import { Playfair_Display, Roboto } from "next/font/google";
import "./globals.css";
import { NotificationCenter } from "@/components/ui/NotificationCenter";
import { GlobalLoadingOverlay } from "@/components/ui/GlobalLoadingOverlay";

const fontDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fontSans = Roboto({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Project Lens",
  description: "The Cognitive IDE — RLM-powered knowledge workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fontSans.variable} ${fontDisplay.variable} antialiased`}>
        {children}
        <GlobalLoadingOverlay />
        <NotificationCenter position="bottom-right" playSound={true} />
      </body>
    </html>
  );
}
