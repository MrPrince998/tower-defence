import type { Metadata } from 'next';
import { Cinzel, Inter } from 'next/font/google';
import { NavBar } from '@/components/NavBar';
import { Providers } from '@/components/Providers';
import { Toasts } from '@/components/Toasts';
import './globals.css';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['600', '800'], variable: '--font-cinzel' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Maze Defense — versus tower defense',
  description: 'Build a maze with your friends and hold the castle against endless waves.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${inter.variable}`}>
      <body className="min-h-full font-sans antialiased">
        <Providers>
          <NavBar />
          <main>{children}</main>
          <Toasts />
        </Providers>
      </body>
    </html>
  );
}
