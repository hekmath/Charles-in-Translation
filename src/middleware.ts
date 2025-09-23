import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Create route matcher for public routes (no authentication required)
const isPublicRoute = createRouteMatcher([
  '/api/inngest(.*)', // Keep Inngest endpoints public for background jobs
]);

// Create route matcher for protected API routes (admin access only)
const isProtectedApiRoute = createRouteMatcher([
  '/api/projects(.*)',
  '/api/translate(.*)',
  '/api/translation-progress(.*)',
  '/api/translation-tasks(.*)',
  '/api/translations(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes to proceed without authentication
  if (isPublicRoute(req)) {
    return;
  }

  // Protect admin API routes and all pages
  if (isProtectedApiRoute(req) || !req.url.includes('/api/')) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
