import { auth } from "@/auth";
import type { MiddlewareHandler } from "astro";
import { defineMiddleware, sequence } from "astro:middleware";

const UNPROTECTED = ["/login", "/register", "/api/auth", "/api/"];

const validation: MiddlewareHandler = async (context, next) => {
  const userAgent = context.request.headers.get("user-agent");
  const contentType = context.request.headers.get("content-type");

  if (
    !userAgent ||
    (userAgent.includes("bot") && !userAgent.includes("Googlebot"))
  ) {
    console.log("Blocked suspicious request");
    return new Response("Forbidden", { status: 403 });
  }

  if (["POST", "PUT", "PATCH"].includes(context.request.method)) {
    if (
      !contentType ||
      (!contentType.includes("application/json") &&
        !contentType.includes("multipart/form-data") &&
        !contentType.includes("application/x-www-form-urlencoded"))
    ) {
      console.log("Invalid content-type for request");
      return new Response("Bad Request - Invalid Content-Type", { status: 400 });
    }
  }

  return await next();
};

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
          stack: error.stack?.split("\n").slice(0, 8),
          cause: error.cause ?? null,
        },
        null,
        2,
      ),
    );
    throw err;
  }
};

const authMiddleware = defineMiddleware(async (context, next) => {
  const session = await auth.api
    .getSession({ headers: context.request.headers })
    .catch((e) => {
      console.error("[AUTH] Session fetch error:", e);
      return null;
    });

  if (session?.user) {
    context.locals.user = session.user;
    context.locals.session = session.session;
  } else {
    context.locals.user = null;
    context.locals.session = null;
  }

  const isPublic = UNPROTECTED.some((r) =>
    context.url.pathname.startsWith(r),
  );

  if (!isPublic && !session) {
    return context.redirect(
      `/login?redirect=${encodeURIComponent(context.url.pathname)}`,
    );
  }

  return next();
});

const securityMiddleware = defineMiddleware(async (context, next) => {
  const { user } = context.locals;
  const { pathname } = context.url;

  const isPublic = UNPROTECTED.some((r) => pathname.startsWith(r));
  if (isPublic) return next();

  if (user) {
    if (user.banned) {
      console.warn(`[SECURITY] Banned user attempted access: ${user.id}`);
      return context.redirect("/api/auth/sign-out?callbackURL=/login?banned=true");
    }

    if (user.mustChangePassword && pathname !== "/change-password") {
      console.info(`[SECURITY] Forcing password change for user: ${user.id}`);
      return context.redirect("/change-password");
    }
  }

  return next();
});

export const onRequest = sequence(
  errorHandler,
  authMiddleware,
  securityMiddleware,
);
