import type { Metadata } from 'next';
import { Noto_Kufi_Arabic } from 'next/font/google';
import './globals.css';

const font = Noto_Kufi_Arabic({ subsets: ['arabic'], display: 'swap' });

export const metadata: Metadata = { title: 'لوحة إدارة المسابقة القرآنية' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${font.className} min-h-screen bg-gray-50 text-gray-900`}>{children}</body>
    </html>
  );
}
