import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "English Honor Societies — Convention Submission Portal",
  description:
    "Verify your English Honor Societies membership and access your convention submission page.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="bg-ehs-700 px-4 py-2 text-sm font-semibold tracking-wide text-white">
          ENGLISH HONOR SOCIETIES
        </div>
        {children}
      </body>
    </html>
  );
}
