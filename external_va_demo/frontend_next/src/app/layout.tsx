import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "External VA Integration Demo",
  description: "Importable widget + protocol agent demo"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
