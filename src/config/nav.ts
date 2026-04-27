import {
    Home,
    History,
    Tags,
    BanknoteArrowUp,
    BanknoteArrowDown,
    ReceiptText,
    Users,
    Building2,
    CalendarClock,
    Layers,
    Building,
    ArrowLeftRight,
    Handshake,
    ShieldAlert,
} from "@lucide/astro";

export interface NavLink {
    label: string;
    href: string;
    icon: any;
}

export interface NavGroup {
    label: string;
    icon: any;
    baseHref: string;
    links: NavLink[];
}

export const navGroups: NavGroup[] = [
    {
        label: "Finanzas",
        icon: Home,
        baseHref: "/",
        links: [
            { label: "Ingresos", href: "/ingresos", icon: BanknoteArrowUp },
            { label: "Egresos", href: "/egresos", icon: BanknoteArrowDown },
            // { label: "Transferencias", href: "/transferencias", icon: ArrowLeftRight },
            { label: "Cajas", href: "/cajas", icon: Layers },
            { label: "Historial", href: "/historial", icon: History },
        ],
    },
    {
        label: "Personal",
        icon: Users,
        baseHref: "/rrhh",
        links: [
            { label: "Personal", href: "/rrhh/personal", icon: Users },
            { label: "Salarios", href: "/rrhh/salarios", icon: CalendarClock },
        ],
    },
    {
        label: "Inmuebles",
        icon: Building,
        baseHref: "/inquilinos",
        links: [
            { label: "Inquilinos", href: "/inquilinos", icon: Building },
            // { label: "Contratistas", href: "/contratistas", icon: Handshake },
        ],
    },
    {
        label: "Configuración",
        icon: Tags,
        baseHref: "/cuentas",
        links: [
            { label: "Cuentas", href: "/cuentas", icon: Tags },
            { label: "Talonarios", href: "/talonarios", icon: ReceiptText },
            { label: "Auditoría", href: "/auditoria", icon: ShieldAlert },
        ],
    },
];
