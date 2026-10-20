import React from 'react';
import { Users } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';

export const FamilyBanner: React.FC = () => {
  const { language, familyMode, exitFamilyMode } = useAppStore();
  if (!familyMode) return null;

  const t = translations[language];
  const labels = {
    parent: t.family_rel_parent,
    sibling: t.family_rel_sibling,
    neighbor: t.family_rel_neighbor,
    other: t.family_rel_other,
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#FF6B35]/30 bg-[#FFF5F0] px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-bold text-[#004D40]">
        <Users className="w-4 h-4 text-[#FF6B35]" />
        <span>{t.family_banner.replace('{who}', labels[familyMode.relation])}</span>
      </div>
      <button
        type="button"
        onClick={exitFamilyMode}
        className="touch-target px-3 py-1.5 rounded-lg bg-white border border-[#004D40]/20 text-xs font-bold text-[#004D40] hover:bg-[#004D40]/5 cursor-pointer"
      >
        {t.family_back_to_mine}
      </button>
    </div>
  );
};
