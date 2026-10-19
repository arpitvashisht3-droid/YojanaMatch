import React, { useState } from 'react';
import { ClipboardCheck, Check } from 'lucide-react';
import type { AppLanguage } from '../types';
import { translations } from '../lib/translations';
import { DOC_LABELS } from '../lib/documentChecklists';
import type { DocId } from '../lib/documentChecklists';

const STORAGE_KEY = 'ym_doc_checks';

function loadChecked(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveChecked(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignored - localStorage unavailable
  }
}

interface DocumentChecklistProps {
  schemeId: string;
  docs: DocId[];
  language: AppLanguage;
}

export const DocumentChecklist: React.FC<DocumentChecklistProps> = ({ schemeId, docs, language }) => {
  const t = translations[language];
  const [checked, setChecked] = useState<string[]>(loadChecked);

  const keyOf = (d: DocId) => schemeId + ':' + d;
  const toggle = (d: DocId) => {
    const k = keyOf(d);
    setChecked((prev) => {
      const next = prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k];
      saveChecked(next);
      return next;
    });
  };

  const done = docs.filter((d) => checked.includes(keyOf(d))).length;
  const pct = docs.length ? Math.round((done / docs.length) * 100) : 0;
  const allReady = docs.length > 0 && done === docs.length;

  return (
    <div
      className="rounded-2xl border border-[#004D40]/10 bg-white p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-[#004D40] font-bold text-sm">
          <ClipboardCheck className="w-4 h-4 text-[#FF6B35]" />
          <span>{t.doc_checklist_title}</span>
        </div>
        <span className="text-xs font-semibold text-[#004D40]/70">
          {t.doc_checklist_progress.replace('{done}', String(done)).replace('{total}', String(docs.length))}
        </span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-[#004D40]/10 overflow-hidden mb-3">
        <div className="h-full bg-[#004D40] transition-all" style={{ width: pct + '%' }} />
      </div>

      <ul className="space-y-1.5">
        {docs.map((d) => {
          const isChecked = checked.includes(keyOf(d));
          return (
            <li key={d}>
              <button
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                onClick={() => toggle(d)}
                className={`touch-target w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left text-sm font-semibold transition-colors cursor-pointer ${
                  isChecked
                    ? 'bg-emerald-50 border-emerald-200 text-[#004D40]'
                    : 'bg-[#FAFAF7] border-[#004D40]/10 text-[#004D40]/80 hover:bg-[#004D40]/5'
                }`}
              >
                <span
                  className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center ${
                    isChecked ? 'bg-[#004D40] border-[#004D40]' : 'bg-white border-[#004D40]/30'
                  }`}
                >
                  {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                </span>
                <span className={isChecked ? 'line-through opacity-70' : ''}>{DOC_LABELS[d][language]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {allReady && (
        <p className="mt-3 text-xs font-bold text-emerald-700">{t.doc_checklist_all_ready}</p>
      )}
      <p className="mt-2 text-[11px] text-[#004D40]/60">{t.doc_checklist_note}</p>
    </div>
  );
};
