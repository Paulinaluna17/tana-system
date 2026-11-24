import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tana Studio", template: "%s · Tana Studio" },
  description: "Calendario de contenidos, aprobaciones y presupuesto de Tana Studio.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F6F3EF" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
