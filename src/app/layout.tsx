import type { Metadata } from 'next';
import { Montserrat, Open_Sans, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Charles in Translation - AI-Powered Localization',
  description:
    'Professional JSON translation tool powered by AI. Translate your application strings quickly and accurately with our intelligent localization platform.',
  keywords: [
    'JSON translation',
    'localization',
    'AI translation',
    'i18n',
    'internationalization',
  ],
  authors: [{ name: 'Charles in Translation' }],
  creator: 'Charles in Translation',
  metadataBase: new URL('https://json-translator.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Charles in Translation - AI-Powered Localization',
    description:
      'Professional JSON translation tool powered by AI. Translate your application strings quickly and accurately.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Charles in Translation',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Charles in Translation - AI-Powered Localization',
    description:
      'Professional JSON translation tool powered by AI. Translate your application strings quickly and accurately.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${openSans.variable} ${geistMono.variable}`}
    >
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0891b2" />
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
