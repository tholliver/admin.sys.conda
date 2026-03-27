import type { auth } from "@/auth";

export type Session = typeof auth.$Infer.Session;

export type AuthUser = {
  id: string;
  name: string;
  emailVerified: boolean;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  image?: string | null | undefined;
  banned: boolean | null | undefined;
  role: UserRole;
  banReason?: string | null;
  banExpires?: Date | null;
  mustChangePassword: boolean | null | undefined;
  passwordResetBy?: string | null | undefined;
  passwordResetAt?: string | null | undefined;
};

export const USER_ROLES = ["ADMIN", "GEN", "ACTS", "ACCO", "ADMON", "AUX", "USER"] as const;
export type UserRole = (typeof USER_ROLES)[number];
