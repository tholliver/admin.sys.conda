import { auth } from "@/auth";
import type { MiddlewareHandler } from "astro";
import { defineMiddleware, sequence } from "astro:middleware";

//export const onRequest = sequence(validation, checkAuth, greeting);
const validation: MiddlewareHandler = async (context, next) => {
  const userAgent = context.request.headers.get("user-agent");
  const contentType = context.request.headers.get("content-type");

  // Block suspicious requests
  if (
    !userAgent ||
    (userAgent.includes("bot") && !userAgent.includes("Googlebot"))
  ) {
    console.log("Blocked suspicious request");
    return new Response("Forbidden", { status: 403 });
  }

  // Validate POST/PUT requests have proper content-type
  if (["POST", "PUT", "PATCH"].includes(context.request.method)) {
    if (
      !contentType ||
      (!contentType.includes("application/json") &&
        !contentType.includes("multipart/form-data") &&
        !contentType.includes("application/x-www-form-urlencoded"))
    ) {
      console.log("Invalid content-type for request");
      return new Response("Bad Request - Invalid Content-Type", {
        status: 400,
      });
    }
  }

  const response = await next();

  console.log("validation response");
  return response;
};

// ============================================================================
// ERROR MIDDLEWARE
// ============================================================================

const errorHandler: MiddlewareHandler = async (context, next) => {
  try {
    return await next();
  } catch (err) {
    const error = err as Error;

    console.error(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          url: context.request.url,
          method: context.request.method,
          message: error.message,
          stack: error.stack?.split("\n").slice(0, 8), // first 8 lines is enough
          cause: error.cause ?? null,
        },
        null,
        2,
      ),
    );

    throw err; // re-throw so Astro renders your 500 page
  }
};

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================
const authMiddleware = defineMiddleware(async (context, next) => {
  const session = await auth.api
    .getSession({
      headers: context.request.headers,
    })
    .catch((e) => {
      console.error("[AUTH] Session fetch error:", e);
      return null;
    });

  if (session?.user) {
    const user = session.user;

    context.locals.user = user;
    context.locals.session = session.session;

  } else {
    context.locals.user = null;
    context.locals.session = null;

  }

  // Redirect unauthenticated users trying to access panel routes
  if (context.url.pathname.startsWith("/") && !session) {
    return context.redirect(
      `/login?redirect=${encodeURIComponent(context.url.pathname)}`,
    );
  }

  return next();
});

// ============================================================================
// SECURITY MIDDLEWARE (Ban & Password Change Enforcement) - NEW
// ============================================================================
const securityMiddleware = defineMiddleware(async (context, next) => {
  const { user } = context.locals;
  const { pathname } = context.url;

  // Skip for public routes and login
  const publicRoutes = ["/login", "/register", "/api/auth"];
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return next();
  }

  // If user is authenticated, check security constraints
  if (user) {
    // 1. Check if user is banned
    if (user.banned) {
      console.warn(`[SECURITY] Banned user attempted access: ${user.id}`);
      // Sign out banned user
      return context.redirect(
        "/api/auth/sign-out?callbackURL=/login?banned=true",
      );
    }

    // 2. Check if user must change password
    if (user.mustChangePassword) {
      // Only allow access to change-password page
      if (pathname !== "/change-password") {
        console.info(`[SECURITY] Forcing password change for user: ${user.id}`);
        return context.redirect("/change-password");
      }
      // User is on change-password page, allow it
      return next();
    }

    // 3. Prevent access to change-password if not required
    // (Optional: remove this if you want users to access it anytime)
    // if (pathname === "/change-password" && !user.mustChangePassword) {
    //   return context.redirect("/panel/settings"); // Or wherever you want
    // }
  }

  return next();
});

// ============================================================================
// EXPORT COMBINED MIDDLEWARE
// ============================================================================
export const onRequest = sequence(
  errorHandler, /// 0. Catch & everything below
  authMiddleware, // 1. Authenticate user
  securityMiddleware, // 2. Check bans & force password changes (NEW)
);
