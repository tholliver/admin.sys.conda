// src/actions/rrhh/payEmployeeFeeOverdraft.action.ts
// Add this alongside your existing payEmployeeFeeAction.
// Register it in your actions index as: rrhh.payEmployeeFeeOverdraft

import { defineAction, ActionError } from "astro:actions";
import { z } from "zod";
import { payEmployeeFeeSchema } from "@/lib/schemas/rrhh.schemas";
import { payEmployeeFeeWithOverdraft } from "@/services/rrhh/payEmployeeFeeOverdraft.service";

const ADMIN_ROLES = ["ADMIN", "ADMON"] as const;

export const payEmployeeFeeOverdraftAction = defineAction({
    accept: "form",
    input: payEmployeeFeeSchema.extend({
        allowOverdraft: z
            .string()
            .optional()
            .transform((v) => v === "true" || v === "on"),
    }),
    handler: async (input, ctx) => {
        const user = ctx.locals.user;
        if (!user) throw new ActionError({ code: "UNAUTHORIZED" });
        if (!ADMIN_ROLES.includes(user.role as any))
            throw new ActionError({ code: "FORBIDDEN", message: "Acceso denegado." });

        try {
            const result = await payEmployeeFeeWithOverdraft(
                { ...input, allowOverdraft: input.allowOverdraft },
                user.id,
            );

            return {
                success:         true,
                message:         result.isOverdraft
                    ? `Pago registrado con deuda de Bs ${result.overdraftAmount} en ${result.cashboxName}.`
                    : "Pago registrado.",
                payment:         result.payment,
                isOverdraft:     result.isOverdraft,
                overdraftAmount: result.overdraftAmount,
                newBalance:      result.newBalance,
                cashboxName:     result.cashboxName,
            };
        } catch (err: any) {
            // Surface structured insufficient-funds so the store can intercept
            if (err?.message?.startsWith("__INSUFFICIENT_FUNDS__")) {
                const [, available, requested, deficit, cashboxName] = err.message.split(":");
                throw new ActionError({
                    code: "CONFLICT",
                    message: `__INSUFFICIENT_FUNDS__:${available}:${requested}:${deficit}:${cashboxName}`,
                });
            }
            throw new ActionError({ code: "CONFLICT", message: err.message });
        }
    },
});
