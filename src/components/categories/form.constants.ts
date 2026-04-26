import { z } from "zod";
import {
    CircleDollarSign, HandCoins, Wallet, Banknote, CreditCard, Receipt,
    PiggyBank, BadgeDollarSign, ShoppingBag, Wrench, Bus, CarFront, Route,
    Map as MapIcon, Landmark, Ticket, Users, IdCard, Fuel, Shield, BadgeCheck,
    FileText, ClipboardList, CalendarCheck, Hammer, AlertTriangle, Building2,
    Handshake,
} from "@lucide/svelte";

// ── Schema ─────────────────────────────────────────────────────────────────────
export const transactionCategorySchema = z.object({
    name: z.string().trim().min(1, "Nombre requerido").max(100, "Nombre demasiado largo"),
    code: z.string().trim().min(1, "Codigo requerido").max(50, "Codigo demasiado largo"),
    type: z.enum(["income", "outcome"]).or(z.literal("")),
    description: z.string().max(500, "Descripcion demasiado larga"),
    icon: z.string().max(50, "Icono demasiado largo"),
    parentId: z.string().uuid("Cuenta padre invalida").or(z.literal("")),
    requiresAuthorization: z.boolean(),
});

export type TransactionCategoryValues = z.infer<typeof transactionCategorySchema>;

// ── Icon map ───────────────────────────────────────────────────────────────────
export const ICON_MAP = {
    "circle-dollar-sign": CircleDollarSign,
    "hand-coins": HandCoins,
    wallet: Wallet,
    banknote: Banknote,
    "credit-card": CreditCard,
    receipt: Receipt,
    "piggy-bank": PiggyBank,
    "badge-dollar-sign": BadgeDollarSign,
    "shopping-bag": ShoppingBag,
    wrench: Wrench,
    bus: Bus,
    "car-front": CarFront,
    route: Route,
    map: MapIcon,
    landmark: Landmark,
    ticket: Ticket,
    users: Users,
    "id-card": IdCard,
    fuel: Fuel,
    shield: Shield,
    "badge-check": BadgeCheck,
    "file-text": FileText,
    "clipboard-list": ClipboardList,
    "calendar-check": CalendarCheck,
    hammer: Hammer,
    "alert-triangle": AlertTriangle,
    "building-2": Building2,
    handshake: Handshake,
} as const;

export type IconKey = keyof typeof ICON_MAP;

export const ICON_OPTIONS: { value: IconKey; label: string }[] = [
    { value: "circle-dollar-sign", label: "Ingreso" },
    { value: "hand-coins",         label: "Egreso" },
    { value: "wallet",             label: "Cartera" },
    { value: "banknote",           label: "Billete" },
    { value: "credit-card",        label: "Tarjeta" },
    { value: "receipt",            label: "Recibo" },
    { value: "piggy-bank",         label: "Ahorro" },
    { value: "badge-dollar-sign",  label: "Cobro" },
    { value: "shopping-bag",       label: "Compra" },
    { value: "wrench",             label: "Servicio" },
    { value: "bus",                label: "Bus" },
    { value: "car-front",          label: "Auto" },
    { value: "route",              label: "Ruta" },
    { value: "map",                label: "Mapa" },
    { value: "landmark",           label: "Sindicato" },
    { value: "ticket",             label: "Ticket" },
    { value: "users",              label: "Socios" },
    { value: "id-card",            label: "Licencia" },
    { value: "fuel",               label: "Combustible" },
    { value: "shield",             label: "Seguro" },
    { value: "badge-check",        label: "Aprobado" },
    { value: "file-text",          label: "Documento" },
    { value: "clipboard-list",     label: "Control" },
    { value: "calendar-check",     label: "Calendario" },
    { value: "hammer",             label: "Mantenimiento" },
    { value: "alert-triangle",     label: "Multa" },
    { value: "building-2",         label: "Oficina" },
    { value: "handshake",          label: "Convenio" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
export const DEFAULT_ICON = {
    income:  CircleDollarSign,
    outcome: HandCoins,
} as const;

export function slugify(v: string): string {
    return v
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 50);
}

export function buildInitialValues(
    defaults: Partial<TransactionCategoryValues & { id?: string }> = {},
): TransactionCategoryValues {
    return {
        name:                   defaults.name                ?? "",
        code:                   defaults.code                ?? "",
        description:            defaults.description         ?? "",
        type:                   (defaults.type as "income" | "outcome" | "") ?? "",
        icon:                   (defaults.icon as IconKey | "") ?? "",
        requiresAuthorization:  Boolean(defaults.requiresAuthorization),
        parentId:               defaults.parentId            ?? "",
    };
}
