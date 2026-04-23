import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jumping Club",
  description: "Gestión del gimnasio Jumping Club",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} dark h-full antialiased`}>
      <body className={`${inter.className} min-h-full`}>
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
