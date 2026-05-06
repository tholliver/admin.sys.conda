export type EmployeeFormData = {
    id?: number;
    employeeType: "directorio" | "planta";
    fullName: string;
    ci: string;
    ciCity?: string | null;
    phone?: string | null;
    address?: string | null;
    chargeTitle: string;
    cashboxId: string | null;
    hireDate?: string | null;
    baseSalary: number | string;
    notes?: string | null;
};
