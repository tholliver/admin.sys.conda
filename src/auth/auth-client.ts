import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [adminClient()],
});

export const {
  signIn,
  signOut,
  useSession,
  admin,
  sendVerificationEmail,
  updateUser,
} = authClient;

export type Session = typeof authClient.$Infer.Session;
export type AuthUser = typeof authClient.$Infer.Session.user;
