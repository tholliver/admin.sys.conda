// config/env.ts
export const ENV = {
    TRANSACTION_HARD_LIMITS: {
        DEPOSIT_MAX: Number(import.meta.env.DEPOSIT_MAX_LIMIT) || 500_000,
        WITHDRAWAL_MAX: Number(import.meta.env.WITHDRAWAL_MAX_LIMIT) || 100_000,
        ABSOLUTE_MAX: Number(import.meta.env.ABSOLUTE_TRANSACTION_MAX) || 1_000_000,
    },
    // PCI DSS Requirement 2: Never use vendor defaults
    SECURITY: {
        REQUIRE_MFA_ABOVE: Number(import.meta.env.MFA_THRESHOLD) || 10_000,
    }
} as const;