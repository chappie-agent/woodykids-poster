import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'WoodyKids Post Builder',
  description: 'Create and schedule social media posts for WoodyKids',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className={`${inter.variable} font-sans bg-woody-bg text-woody-primary`}>
        {children}
      </body>
    </html>
  );
}
