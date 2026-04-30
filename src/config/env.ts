// config/env.ts
export const ENV = {
  TRANSACTION_LIMITS: {
    DEPOSIT_MAX: 500_000,
    WITHDRAWAL_MAX: 500_000,
    ABSOLUTE_MAX: 999_000,
  },
  SECURITY: {
    MFA_THRESHOLD: Number(import.meta.env.VITE_MFA_THRESHOLD) || 10_000,
  },
} as const;
