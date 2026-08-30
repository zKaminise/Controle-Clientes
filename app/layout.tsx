import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://clientes.gabrielmisao.com.br'),
  title: 'Minha Operação — Gestão de clientes',
  description: 'Central privada de clientes, projetos, cobranças, domínios e oportunidades.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Minha Operação',
    description: 'Clientes, projetos e oportunidades em um só lugar.',
    images: ['/og.png'],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Minha Operação',
    description: 'Clientes, projetos e oportunidades em um só lugar.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
