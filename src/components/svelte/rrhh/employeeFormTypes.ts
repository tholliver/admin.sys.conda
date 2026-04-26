export type EmployeeFormData = {
    id?: number;
    employeeType: "directorio" | "planta";
    fullName: string;
    ci: string;
    ciCity?: string | null;
    phone?: string | null;
    address?: string | null;
    chargeTitle: string;
    sectorId: number | string;
    hireDate?: string | null;
    baseSalary: number | string;
    notes?: string | null;
};
