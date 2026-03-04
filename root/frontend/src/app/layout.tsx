import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

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
    <html lang="en">
      <body className="font-sans antialiased min-h-screen bg-(--background) text-(--foreground)" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}