import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pipeline Report",
  description: "Project & Sales Pipeline Report",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
