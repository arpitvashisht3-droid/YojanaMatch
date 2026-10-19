import React, { useState, useMemo } from 'react';
import { Calculator } from 'lucide-react';
import type { AppLanguage } from '../types';
import { translations } from '../lib/translations';

export function calculateEmi(principal: number, annualRatePercent: number, months: number) {
  if (months <= 0 || principal <= 0) {
    return { emi: 0, totalPayable: 0, totalInterest: 0 };
  }
  const r = annualRatePercent / 12 / 100;
  const emi =
    r === 0
      ? principal / months
      : (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  const totalPayable = emi * months;
  return { emi, totalPayable, totalInterest: totalPayable - principal };
}

function formatINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

interface EmiCalculatorProps {
  language: AppLanguage;
  maxAmount: number;
  defaultAmount?: number;
  defaultRate?: number;
  defaultTenureYears?: number;
  maxTenureYears?: number;
}

export const EmiCalculator: React.FC<EmiCalculatorProps> = ({
  language,
  maxAmount,
  defaultAmount,
  defaultRate = 9,
  defaultTenureYears = 3,
  maxTenureYears = 7,
}) => {
  const t = translations[language];
  const startAmount = Math.min(defaultAmount ?? maxAmount, maxAmount);
  const [amount, setAmount] = useState<number>(startAmount);
  const [rate, setRate] = useState<number>(defaultRate);
  const [years, setYears] = useState<number>(Math.min(defaultTenureYears, maxTenureYears));

  const amountStep = Math.max(1000, Math.round(maxAmount / 200 / 1000) * 1000);
  const minAmount = Math.min(amountStep, maxAmount);

  const result = useMemo(() => calculateEmi(amount, rate, years * 12), [amount, rate, years]);

  return (
    <div
      className="mt-4 rounded-2xl border border-[#004D40]/10 bg-[#FAFAF7] p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-3 text-[#004D40] font-bold text-sm">
        <Calculator className="w-4 h-4 text-[#FF6B35]" />
        <span>{t.emi_title}</span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs font-semibold text-[#004D40]/80 mb-1">
            <span>{t.emi_loan_amount}</span>
            <span className="text-[#004D40]">{formatINR(amount)}</span>
          </div>
          <input
            type="range"
            min={minAmount}
            max={maxAmount}
            step={amountStep}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full cursor-pointer accent-[#004D40]"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold text-[#004D40]/80 mb-1">
            <span>{t.emi_interest_rate}</span>
            <span className="text-[#004D40]">{rate}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-full cursor-pointer accent-[#004D40]"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold text-[#004D40]/80 mb-1">
            <span>{t.emi_tenure}</span>
            <span className="text-[#004D40]">{years} {t.emi_years}</span>
          </div>
          <input
            type="range"
            min={1}
            max={maxTenureYears}
            step={1}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="w-full cursor-pointer accent-[#004D40]"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white border border-[#FF6B35]/30 p-2">
          <div className="text-[10px] font-semibold text-[#004D40]/60">{t.emi_monthly}</div>
          <div className="text-sm sm:text-base font-bold text-[#FF6B35]">{formatINR(result.emi)}</div>
        </div>
        <div className="rounded-xl bg-white border border-[#004D40]/10 p-2">
          <div className="text-[10px] font-semibold text-[#004D40]/60">{t.emi_total_interest}</div>
          <div className="text-sm sm:text-base font-bold text-[#004D40]">{formatINR(result.totalInterest)}</div>
        </div>
        <div className="rounded-xl bg-white border border-[#004D40]/10 p-2">
          <div className="text-[10px] font-semibold text-[#004D40]/60">{t.emi_total_payable}</div>
          <div className="text-sm sm:text-base font-bold text-[#004D40]">{formatINR(result.totalPayable)}</div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-[#004D40]/60">{t.emi_disclaimer}</p>
    </div>
  );
};
