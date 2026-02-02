import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "runnr | AI-Powered Running Route Generator",
  description: "Generate custom running routes tailored to your distance, elevation, and terrain. Powered by AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={plusJakarta.variable}>
      <body className="font-sans antialiased min-h-screen bg-(--background) text-(--foreground)">
        {children}
      </body>
    </html>
  );
}