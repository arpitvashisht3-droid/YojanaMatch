export interface EmiDefaults {
  maxAmount: number;
  defaultAmount: number;
  defaultRate: number; // % per year, editable by the user in the calculator
  defaultTenureYears: number;
  maxTenureYears: number;
}

// Only loan-type schemes appear here. Grants and equity schemes are left out on purpose.
// Rates: pm_vishwakarma 5%, mahila_samridhi_yojana 4%, day_nulm_sep 7% and pm_svanidhi 7%
// come from schemes.json. All others are a neutral 10% placeholder, since the bank decides.
// Please verify each row against the official scheme page before the final submission.
export const EMI_DEFAULTS: Record<string, EmiDefaults> = {
  pmegp:                  { maxAmount: 5000000,  defaultAmount: 500000,  defaultRate: 10, defaultTenureYears: 5, maxTenureYears: 7 },
  standup_india:          { maxAmount: 10000000, defaultAmount: 1000000, defaultRate: 10, defaultTenureYears: 5, maxTenureYears: 7 },
  pm_mudra:               { maxAmount: 2000000,  defaultAmount: 500000,  defaultRate: 10, defaultTenureYears: 3, maxTenureYears: 5 },
  pm_svanidhi:            { maxAmount: 50000,    defaultAmount: 10000,   defaultRate: 7,  defaultTenureYears: 1, maxTenureYears: 3 },
  pm_vishwakarma:         { maxAmount: 300000,   defaultAmount: 100000,  defaultRate: 5,  defaultTenureYears: 3, maxTenureYears: 4 },
  mahila_samridhi_yojana: { maxAmount: 140000,   defaultAmount: 100000,  defaultRate: 4,  defaultTenureYears: 3, maxTenureYears: 5 },
  day_nulm_sep:           { maxAmount: 200000,   defaultAmount: 100000,  defaultRate: 7,  defaultTenureYears: 3, maxTenureYears: 5 },
  cgtmse:                 { maxAmount: 50000000, defaultAmount: 1000000, defaultRate: 10, defaultTenureYears: 5, maxTenureYears: 7 },
};
