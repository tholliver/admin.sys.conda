/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    user: import("@/auth/types").AuthUser | null;
    session: import("better-auth").Session | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
}

interface ImportMetaEnv {
  readonly DEPOSIT_MAX_LIMIT: number,
  readonly WITHDRAWAL_MAX_LIMIT: number,
  readonly ABSOLUTE_TRANSACTION_MAX: number,

  readonly RATE_LIMIT_WINDOW: number,
  readonly MAX_ATTEMPTS: number,
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
