import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';
import { INDIAN_STATES_AND_UTS } from '../lib/userProfileHelper';
import type {
  BusinessType,
  CasteCategory,
  CourseType,
  DistrictType,
  EducationLevel,
  FamilyRelation,
  Gender,
  UserProfile,
} from '../types';

const RELATIONS: FamilyRelation[] = ['parent', 'sibling', 'neighbor', 'other'];

const INCOME_OPTIONS = [
  { key: 'income_below_1l', value: 80000 },
  { key: 'income_1_3l', value: 200000 },
  { key: 'income_3_6l', value: 450000 },
  { key: 'income_above_6l', value: 800000 },
] as const;

const selectClass =
  'w-full px-3 py-2.5 rounded-xl border border-[#004D40]/20 text-sm bg-white focus:outline-none focus:border-[#004D40]';

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`touch-target px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors cursor-pointer ${
      active
        ? 'bg-[#004D40] text-white border-[#004D40]'
        : 'bg-white text-[#004D40] border-[#004D40]/20 hover:bg-[#004D40]/5'
    }`}
  >
    {children}
  </button>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-xs font-bold text-[#004D40] uppercase tracking-wider mb-2">{label}</div>
    {children}
  </div>
);

export const FamilyProfileScreen: React.FC = () => {
  const { language, contentMode, familyMode, extractedProfile, startFamilyMatch } = useAppStore();
  const t = translations[language];

  // When editing an existing family search, start from what was entered before.
  const prefill: UserProfile = familyMode ? extractedProfile : {};

  const [relation, setRelation] = useState<FamilyRelation>(familyMode ? familyMode.relation : 'parent');
  const [age, setAge] = useState<string>(prefill.age ? String(prefill.age) : '');
  const [gender, setGender] = useState<Gender | undefined>(prefill.gender);
  const [caste, setCaste] = useState<CasteCategory | undefined>(prefill.caste_category);
  const [disabled, setDisabled] = useState<boolean>(!!prefill.is_differently_abled);
  const [stateName, setStateName] = useState<string>(prefill.state || '');
  const [area, setArea] = useState<DistrictType | undefined>(prefill.district_type);
  const [bizType, setBizType] = useState<BusinessType | undefined>(prefill.business_type);
  const [income, setIncome] = useState<number | undefined>(prefill.estimated_income ?? undefined);
  const [eduLevel, setEduLevel] = useState<EducationLevel | undefined>(prefill.education_level);
  const [marks, setMarks] = useState<string>(
    prefill.current_marks_percentage ? String(prefill.current_marks_percentage) : ''
  );
  const [courseType, setCourseType] = useState<CourseType | undefined>(prefill.course_type);

  const relationLabels: Record<FamilyRelation, string> = {
    parent: t.family_rel_parent,
    sibling: t.family_rel_sibling,
    neighbor: t.family_rel_neighbor,
    other: t.family_rel_other,
  };

  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'female', label: t.gender_female },
    { value: 'male', label: t.gender_male },
    { value: 'transgender', label: t.gender_transgender },
  ];

  const casteOptions: { value: CasteCategory; label: string }[] = [
    { value: 'sc', label: 'SC' },
    { value: 'st', label: 'ST' },
    { value: 'obc', label: 'OBC' },
    { value: 'minority', label: t.cat_minority },
    { value: 'general', label: t.cat_general },
    { value: 'ews', label: 'EWS' },
  ];

  const areaOptions: { value: DistrictType; label: string }[] = [
    { value: 'rural', label: t.area_rural },
    { value: 'semi-urban', label: t.area_semi_urban },
    { value: 'urban', label: t.area_urban },
  ];

  const bizOptions: { value: BusinessType; label: string }[] = [
    { value: 'textile_weaving', label: t.biz_type_tailoring },
    { value: 'dairy_livestock', label: t.biz_type_farming },
    { value: 'retail_shop', label: t.biz_type_retail },
    { value: 'food_processing', label: t.biz_type_food },
    { value: 'street_vendor', label: t.biz_type_vendor },
    { value: 'artisan_handicraft', label: t.biz_type_artisan },
    { value: 'services', label: t.biz_type_services },
    { value: 'manufacturing', label: t.biz_type_manufacturing },
  ];

  const eduOptions: { value: EducationLevel; label: string }[] = [
    { value: 'school', label: t.family_edu_school },
    { value: 'undergraduate', label: t.family_edu_undergraduate },
    { value: 'postgraduate', label: t.family_edu_postgraduate },
    { value: 'diploma', label: t.family_edu_diploma },
  ];

  const courseOptions: { value: CourseType; label: string }[] = [
    { value: 'general', label: t.family_course_general },
    { value: 'technical', label: t.family_course_technical },
    { value: 'medical', label: t.family_course_medical },
    { value: 'vocational', label: t.family_course_vocational },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAge = age.trim() ? parseInt(age.trim(), 10) : NaN;
    const parsedMarks = marks.trim() ? parseFloat(marks.trim()) : NaN;

    const profile: UserProfile = {};
    if (!isNaN(parsedAge)) profile.age = parsedAge;
    if (gender) profile.gender = gender;
    if (caste) profile.caste_category = caste;
    if (disabled) profile.is_differently_abled = true;
    if (stateName) profile.state = stateName;
    if (area) profile.district_type = area;
    if (income !== undefined) profile.estimated_income = income;

    if (contentMode === 'scholarships') {
      if (eduLevel) profile.education_level = eduLevel;
      if (!isNaN(parsedMarks)) profile.current_marks_percentage = parsedMarks;
      if (courseType) profile.course_type = courseType;
    } else if (bizType) {
      profile.business_type = bizType;
    }

    await startFamilyMatch(profile, relation);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-[#004D40]/10 shadow-xs p-5 sm:p-8 space-y-6"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF6B35]/15 text-[#FF6B35] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#004D40]">{t.family_title}</h1>
            <p className="text-xs sm:text-sm text-[#004D40]/65 mt-1">{t.family_subtitle}</p>
            <p className="text-xs font-semibold text-[#FF6B35] mt-1">{t.family_optional}</p>
          </div>
        </div>

        <Field label={t.family_relation_label}>
          <div className="flex flex-wrap gap-2">
            {RELATIONS.map((r) => (
              <Chip key={r} active={relation === r} onClick={() => setRelation(r)}>
                {relationLabels[r]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label={t.family_label_age}>
          <input
            type="number"
            min={14}
            max={99}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 45"
            className={selectClass}
          />
        </Field>

        <Field label={t.label_gender}>
          <div className="flex flex-wrap gap-2">
            {genderOptions.map((o) => (
              <Chip
                key={o.value}
                active={gender === o.value}
                onClick={() => setGender(gender === o.value ? undefined : o.value)}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label={t.family_label_category}>
          <div className="flex flex-wrap gap-2">
            {casteOptions.map((o) => (
              <Chip
                key={o.value}
                active={caste === o.value}
                onClick={() => setCaste(caste === o.value ? undefined : o.value)}
              >
                {o.label}
              </Chip>
            ))}
            <Chip active={disabled} onClick={() => setDisabled(!disabled)}>
              {t.cat_pwd}
            </Chip>
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t.label_state}>
            <select value={stateName} onChange={(e) => setStateName(e.target.value)} className={selectClass}>
              <option value="">{t.select_state}</option>
              {INDIAN_STATES_AND_UTS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t.family_label_income}>
            <select
              value={income === undefined ? '' : String(income)}
              onChange={(e) => setIncome(e.target.value ? Number(e.target.value) : undefined)}
              className={selectClass}
            >
              <option value="">-</option>
              {INCOME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t[o.key]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t.label_district_type}>
          <div className="flex flex-wrap gap-2">
            {areaOptions.map((o) => (
              <Chip
                key={o.value}
                active={area === o.value}
                onClick={() => setArea(area === o.value ? undefined : o.value)}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </Field>

        {contentMode === 'scholarships' ? (
          <div className="space-y-4 pt-2 border-t border-[#004D40]/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t.family_label_edu}>
                <select
                  value={eduLevel || ''}
                  onChange={(e) => setEduLevel((e.target.value || undefined) as EducationLevel | undefined)}
                  className={selectClass}
                >
                  <option value="">-</option>
                  {eduOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.family_label_marks}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                  placeholder="e.g. 75"
                  className={selectClass}
                />
              </Field>
            </div>
            <Field label={t.family_label_course}>
              <select
                value={courseType || ''}
                onChange={(e) => setCourseType((e.target.value || undefined) as CourseType | undefined)}
                className={selectClass}
              >
                <option value="">-</option>
                {courseOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <Field label={t.label_biz_type}>
            <select
              value={bizType || ''}
              onChange={(e) => setBizType((e.target.value || undefined) as BusinessType | undefined)}
              className={selectClass}
            >
              <option value="">-</option>
              {bizOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        <button
          type="submit"
          className="touch-target w-full py-3.5 rounded-xl bg-[#FF6B35] hover:bg-[#E8551F] text-white font-bold text-base shadow-sm shadow-[#FF6B35]/20 cursor-pointer transition-all"
        >
          {t.family_btn_find}
        </button>
      </form>
    </div>
  );
};
