import { db } from "@/db";
import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { admin as adminPlugin } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import * as schema from "@/db/schema";
import { USER_ROLES } from "@/auth/types";
import { getRateLimitCount, incrementRateLimit } from "./config";
import { MAX_ATTEMPTS } from "./config";

export const auth = betterAuth({
  secret: import.meta.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET,

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;

      try {
        const email = ctx.body?.email;
        if (!email) return;

        const identifier = `login:${email}`;
        const count = await getRateLimitCount(identifier);

        if (count >= MAX_ATTEMPTS) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Demasiados intentos fallidos. Espera 15 minutos.",
          });
        }
      } catch (error) {
        if (error instanceof APIError) throw error;
        console.error("Rate limit DB error:", error);
      }
    }),

    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;

      // Only increment on failed login (no session returned = failure)
      const isSuccess = !!ctx.context.newSession;
      if (isSuccess) return;

      try {
        const email = ctx.body?.email;
        if (!email) return;

        await incrementRateLimit(`login:${email}`);
      } catch (error) {
        console.error("Rate limit increment error:", error);
      }
    }),
  },
  rateLimit: {
    /* NOT USED */
    enabled: false,
    storage: "database",
    modelName: "rate_limit",
    window: 900, //  15 mins
    max: 20,
    customRules: {
      "/sign-in/email": {
        window: 900, // 15 mins
        max: 5,
      },
      "/sign-up/email": {
        window: 3600, // 1 Hour
        max: 3,
      },
    },
    // customStorage: {
    //   get: async (key) => {

    //     console.log(key)
    //   },
    //   set: async (key, value) => { }
    // }
  },
  // advanced: {
  //   ipAddress: {
  //     ipAddressHeaders: ["x-real-ip", "x-forwarded-for", "cf-connecting-ip"],
  //   }
  // },
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    sendResetPassword: async ({ user, url, token }) => {
      void sendEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Click the link to reset your password: ${url} ${token}`,
      });
    },
    onPasswordReset: async ({ user }) => {
      console.log(`Password for user ${user.email} has been reset.`);
    },
  },

  plugins: [
    adminPlugin({
      adminRoles: ["ADMIN", "ADMON"],
      roles: {
        ADMIN: adminAc,
        ADMON: adminAc,
        // Default to no admin permissions for other roles
        GEN: userAc,
        ACTS: userAc,
        ACCO: userAc,
        AUX: userAc,
        USER: userAc,
        user: userAc,
      },
    }),
  ],

  user: {
    additionalFields: {
      role: {
        type: [...USER_ROLES],
      },
      ci: {
        type: "string",
        required: true,
        input: true,
      },
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      passwordResetBy: {
        type: "string",
        required: false,
        input: false,
      },
      passwordResetAt: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.user,
      rate_limit: schema.rateLimit,
    },
  }),

  trustedOrigins: [
    "http://localhost:4321",
    "http://192.168.*.*:*",
    "http://192.168.*.*",
  ],
});

function sendEmail(arg0: { to: string; subject: string; text: string }) {
  console.log("Email sent (void)");
}

const getUserKeyFromRequest = async (req: Request) => {
  try {
    // For authenticated requests, try to get user ID
    const sessionToken = req.headers.get('cookie')?.match(/session_token=([^;]+)/)?.[1];
    if (sessionToken) {
      // You'd validate the session here and return user ID
      // For now, using a placeholder approach
      return `user_${sessionToken.slice(0, 10)}`;
    }
    // For non-authenticated requests in dev, use a combination of IP + user agent
    const userAgent = req.headers.get('user-agent') || '';
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    return `${ip}_${userAgent.slice(0, 20)}`;
  } catch {
    return 'fallback_key';
  }
};
