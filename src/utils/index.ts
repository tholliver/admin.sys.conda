const API_BASE = "/api";

export const apiEndpoints = {
  auth: {
    login: `${API_BASE}/auth/login`,
    logout: `${API_BASE}/auth/logout`,
    register: `${API_BASE}/auth/register`,
    refreshToken: `${API_BASE}/auth/refresh-token`,
  },
  user: {
    profile: `${API_BASE}/user/profile`,
    update: `${API_BASE}/user/update`,
    delete: `${API_BASE}/user/delete`,
  },
  drivers: {
    nextAffiliationNumber: `${API_BASE}/drivers/next-affil-number.json`,
    all: `${API_BASE}/drivers/all.json`,
    sector: (driverId: number) =>
      `${API_BASE}/drivers/${driverId}/update/sector.json`,
    group: (driverId: number) =>
      `${API_BASE}/drivers/${driverId}/update/group.json`,
    create: `${API_BASE}/drivers/create.json`,
    update: `${API_BASE}/drivers/update.json`,
    status: `${API_BASE}/drivers/status.json`,
    export: `${API_BASE}/drivers/export.json`,
    penalties: (id: string | number) =>
      `${API_BASE}/drivers/${id}/penalties.json`,
    profile: (id: string | number) => `${API_BASE}/drivers/${id}/profile.json`,
    statusHistory: (id: string | number) =>
      `${API_BASE}/drivers/${id}/status-history.json`,
    missedEvents: (id: string | number) =>
      `${API_BASE}/drivers/${id}/missed-events.json`,
    history: (id: string | number) => `${API_BASE}/drivers/${id}/history.json`,
    info: (id: string | number) => `/drivers/${id}/update/info.json`,
  },
  vehicles: {
    create: `${API_BASE}/vehicles/create.json`,
    update: (id: number) => `${API_BASE}/vehicles/${id}/update.json`,
    transfer: `${API_BASE}/vehicles/transfer.json`,
    check: `${API_BASE}/vehicles/check.json`,
    delete: (id: number) => `${API_BASE}/vehicles/${id}/delete.json`,
  },
  items: {
    all: `${API_BASE}/items/all.json`,
    createUpdate: `${API_BASE}/items/create-update.json`,
    update: `${API_BASE}/items/update.json`,
    crud: `${API_BASE}/items`,
  },
  sectors: {
    all: `${API_BASE}/sectors/all.json`,
    createUpdate: `${API_BASE}/sectors/create-update.json`,
    crud: `${API_BASE}/sectors`,
    sectorChange: `${API_BASE}/sectors/sector-change.json`,
  },
  exchanges: {
    latest: `${API_BASE}/exchanges/latest.json`,
    crud: (id: string | number) => `${API_BASE}/exchanges/${id}/crud.json`,
  },
  discounts: {
    list: `${API_BASE}/discounts/latest.json`,
    crud: (id: string | number) => `${API_BASE}/discounts/${id}/crud.json`,
    elegible: (id: string | number) =>
      `${API_BASE}/drivers/${id}/discount-eligibility.json`,
    override: (id: number, overrideId: number) =>
      `${API_BASE}/discounts/${id}/individual/${overrideId}/update.json`,
  },
  groups: {
    all: `${API_BASE}/groups/all.json`,
    createUpdate: `${API_BASE}/groups/create-update.json`,
    crud: `${API_BASE}/groups`,
  },
  reports: {
    print: `${API_BASE}/reports/print.json`,
    // for /reportes route -> drivers
    exportExcel: `${API_BASE}/reports/drivers/generic.json`,
    // advancedExcel: `${API_BASE}/reports/drivers/advanced.json`,
  },
  events: {
    list: `${API_BASE}/events/all.json`,
    getById: (id: string | number) => `${API_BASE}/events/${id}/details.json`,
    create: `${API_BASE}/events/create.json`,
    update: (id: string | number) => `${API_BASE}/events/${id}/update.json`,
    delete: (id: string | number) => `${API_BASE}/events/${id}/delete.json`,
    attendances: (id: string | number) =>
      `${API_BASE}/events/${id}/attendances.json`,
    affiliationFeeMissed: (id: string | number) =>
      `${API_BASE}/events/${id}/affiliation-fee-missed.json`,
    bulk: (id: string | number) => `${API_BASE}/events/${id}/bulk.json`,
  },
  penalties: {
    eventPayment: `${API_BASE}/penalties/event-payment.json`,
    create: `${API_BASE}/penalties/create.json`,
    update: (id: string | number) => `${API_BASE}/penalties/${id}/update.json`,
    pay: `${API_BASE}/penalties/pay.json`,
  },
  invoiceRanges: {
    all:          `${API_BASE}/invoice-ranges/all.json`,
    createUpdate: `${API_BASE}/invoice-ranges/create-update.json`,
    delete:       (id: string) => `${API_BASE}/invoice-ranges/${id}/delete.json`,
  },
};
