import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { ClerkProvider } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'i18n Translation - AI-Powered Localization',
  description:
    'Professional JSON translation tool powered by AI. Translate your application strings quickly and accurately with our intelligent localization platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0891b2" />
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground">
        <ClerkProvider>
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
