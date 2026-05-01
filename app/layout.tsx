import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RITUAL CHAT",
  description: "Your AI Agent on Ritual",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
