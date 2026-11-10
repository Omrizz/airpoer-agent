// Per-airport FY2025 FAA CATS Form 127 figures for the shortlist (see docs/FINANCE.md, snapshot/airport_finance_fy2025.csv).
// Opex is line 6.7 (before depreciation). Source: dwuconsulting.com/airports/<code>, a copy of the filed forms; EWR, BTV and FLL were checked against cats.airports.faa.gov.

export interface FiledFigures { fiscal_year: number; enplanements: number; revenue_usd_k: number; opex_usd_k: number; }

export const FILED_FIGURES: Record<string, FiledFigures> = {
  MCO: { fiscal_year: 2025, enplanements: 28357361, revenue_usd_k: 838312, opex_usd_k: 530226 },
  SFO: { fiscal_year: 2025, enplanements: 26965912, revenue_usd_k: 1369248, opex_usd_k: 731745 },
  ORD: { fiscal_year: 2025, enplanements: 42317469, revenue_usd_k: 1721650, opex_usd_k: 1079611 },
  EWR: { fiscal_year: 2025, enplanements: 23612851, revenue_usd_k: 1426263, opex_usd_k: 824206 },
  SEA: { fiscal_year: 2025, enplanements: 26316731, revenue_usd_k: 908522, opex_usd_k: 537028 },
  DEN: { fiscal_year: 2025, enplanements: 41199036, revenue_usd_k: 1317142, opex_usd_k: 718563 },
  PDX: { fiscal_year: 2025, enplanements: 9049066, revenue_usd_k: 400624, opex_usd_k: 204584 },
  MIA: { fiscal_year: 2025, enplanements: 27717251, revenue_usd_k: 1000096, opex_usd_k: 777516 },
  FLL: { fiscal_year: 2025, enplanements: 16224254, revenue_usd_k: 385604, opex_usd_k: 292278 },
  RSW: { fiscal_year: 2025, enplanements: 5526505, revenue_usd_k: 167028, opex_usd_k: 108208 },
  BDL: { fiscal_year: 2025, enplanements: 3378637, revenue_usd_k: 113066, opex_usd_k: 86188 },
  BTV: { fiscal_year: 2025, enplanements: 719870, revenue_usd_k: 23681, opex_usd_k: 24023 },
};
