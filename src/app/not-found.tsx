import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-card">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-lg mx-auto mb-4">
          <span className="text-primary-foreground font-bold text-2xl">404</span>
        </div>
        <h1 className="text-3xl font-heading font-black text-foreground tracking-tight mb-2">
          Page Not Found
        </h1>
        <p className="text-muted-foreground mb-6">
The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}