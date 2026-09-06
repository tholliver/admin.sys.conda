// src/utils/routes.ts
const API = "/api";

export const api = {
  auth: {
    login:        `${API}/auth/login`,
    logout:       `${API}/auth/logout`,
    register:     `${API}/auth/register`,
    refreshToken: `${API}/auth/refresh-token`,
  },
  drivers: {
    nextAffiliationNumber: `${API}/drivers/next-affil-number.json`,
    all:           `${API}/drivers/all.json`,
    create:        `${API}/drivers/create.json`,
    update:        `${API}/drivers/update.json`,
    status:        `${API}/drivers/status.json`,
    export:        `${API}/drivers/export.json`,
    sector:        (id: number) => `${API}/drivers/${id}/update/sector.json`,
    group:         (id: number) => `${API}/drivers/${id}/update/group.json`,
    penalties:     (id: string | number) => `${API}/drivers/${id}/penalties.json`,
    profile:       (id: string | number) => `${API}/drivers/${id}/profile.json`,
    statusHistory: (id: string | number) => `${API}/drivers/${id}/status-history.json`,
    missedEvents:  (id: string | number) => `${API}/drivers/${id}/missed-events.json`,
    history:       (id: string | number) => `${API}/drivers/${id}/history.json`,
    info:          (id: string | number) => `/drivers/${id}/update/info.json`,
  },
  vehicles: {
    create:   `${API}/vehicles/create.json`,
    transfer: `${API}/vehicles/transfer.json`,
    check:    `${API}/vehicles/check.json`,
    update:   (id: number) => `${API}/vehicles/${id}/update.json`,
    delete:   (id: number) => `${API}/vehicles/${id}/delete.json`,
  },
  invoiceRanges: {
    all:          `${API}/invoice-ranges/all.json`,
    createUpdate: `${API}/invoice-ranges/create-update.json`,
    delete:       (id: string) => `${API}/invoice-ranges/${id}/delete.json`,
  },
  reports: {
    print:       `${API}/reports/print.json`,
    exportExcel: `${API}/reports/drivers/generic.json`,
  },
  events: {
    list:       `${API}/events/all.json`,
    create:     `${API}/events/create.json`,
    getById:    (id: string | number) => `${API}/events/${id}/details.json`,
    update:     (id: string | number) => `${API}/events/${id}/update.json`,
    delete:     (id: string | number) => `${API}/events/${id}/delete.json`,
    attendances:(id: string | number) => `${API}/events/${id}/attendances.json`,
    bulk:       (id: string | number) => `${API}/events/${id}/bulk.json`,
  },
  penalties: {
    create:        `${API}/penalties/create.json`,
    eventPayment:  `${API}/penalties/event-payment.json`,
    pay:           `${API}/penalties/pay.json`,
    update:        (id: string | number) => `${API}/penalties/${id}/update.json`,
  },
  exchanges: {
    latest: `${API}/exchanges/latest.json`,
    crud:   (id: string | number) => `${API}/exchanges/${id}/crud.json`,
  },
  discounts: {
    list:     `${API}/discounts/latest.json`,
    elegible: (id: string | number) => `${API}/drivers/${id}/discount-eligibility.json`,
    crud:     (id: string | number) => `${API}/discounts/${id}/crud.json`,
    override: (id: number, ovId: number) => `${API}/discounts/${id}/individual/${ovId}/update.json`,
  },
} as const;
