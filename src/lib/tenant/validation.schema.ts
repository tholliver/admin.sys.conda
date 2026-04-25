/**
 * tenant-form.schema.ts
 *
 * Shared Zod schema for the tenant form.
 * Both CreateTenantDialog and EditTenantDialog import from here —
 * one place to update field rules, one place to update initialValues.
 */
import { z } from "zod";

export const BO_CITIES = [
    { value: "CB", label: "Cochabamba" },
    { value: "LP", label: "La Paz" },
    { value: "SC", label: "Santa Cruz" },
    { value: "OR", label: "Oruro" },
    { value: "PT", label: "Potosí" },
    { value: "SU", label: "Sucre" },
    { value: "TJ", label: "Tarija" },
    { value: "BE", label: "Beni" },
    { value: "PA", label: "Pando" },
    { value: "QR", label: "QR" },
] as const;

export const tenantSchema = z.object({
    fullName:    z.string().trim().min(2, "Nombre requerido").max(200),
    ci:          z.string().trim().max(20).optional().or(z.literal("")),
    ciCity:      z.string().max(5).optional().or(z.literal("")),
    phone:       z.string().trim().max(20).optional().or(z.literal("")),
    email: z.union([z.literal(""), z.email("Correo inválido")]).optional(),
    description: z.string().trim().max(255).optional().or(z.literal("")),
    monthlyRent: z.string().regex(/^\d+(\.\d{1,2})?$/, "Monto inválido").refine(
        (v) => parseFloat(v) > 0,
        "Monto debe ser mayor a 0",
    ),
    startDate:   z.string().min(1, "Fecha de inicio requerida"),
    endDate:     z.string().optional().or(z.literal("")),
    notes:       z.string().trim().max(1000).optional().or(z.literal("")),
});

export type TenantFormValues = z.infer<typeof tenantSchema>;

export const tenantInitialValues: TenantFormValues = {
    fullName:    "",
    ci:          "",
    ciCity:      "CB",
    phone:       "",
    email:       "",
    description: "",
    monthlyRent: "",
    startDate:   "",
    endDate:     "",
    notes:       "",
};

/** Converts validated form values to a FormData for the Astro action. */
export function toTenantFormData(values: TenantFormValues, id?: number): FormData {
    const fd = new FormData();
    if (id !== undefined) fd.set("id", String(id));
    fd.set("fullName",    values.fullName.trim());
    fd.set("monthlyRent", values.monthlyRent);
    fd.set("startDate",   values.startDate);
    if (values.ci?.trim())          fd.set("ci",          values.ci.trim());
    if (values.ciCity?.trim())      fd.set("ciCity",      values.ciCity.trim());
    if (values.phone?.trim())       fd.set("phone",       values.phone.trim());
    if (values.email?.trim())       fd.set("email",       values.email.trim());
    if (values.description?.trim()) fd.set("description", values.description.trim());
    if (values.endDate?.trim())     fd.set("endDate",     values.endDate.trim());
    if (values.notes?.trim())       fd.set("notes",       values.notes.trim());
    return fd;
}
