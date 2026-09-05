import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LeadBot Pro - SEC EDGAR Lead Generator',
  description: 'Extract executives from SEC filings and generate real Gmail addresses',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}