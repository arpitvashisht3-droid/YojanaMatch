import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  ArrowLeft,
  Save,
  CheckCircle,
  Briefcase,
  MapPin,
  ShieldCheck,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';
import { INDIAN_STATES_AND_UTS } from '../lib/userProfileHelper';
import { CasteCategory, DistrictType, BusinessType, Gender, UserRecord } from '../types';

export const ProfileScreen: React.FC = () => {
  const { language, user, updateUserProfile, navigateTo, logout } = useAppStore();
  const t = translations[language];

  const [name, setName] = useState(user?.name || '');
  const [ageRange, setAgeRange] = useState<string>(user?.age_range || '');
  const [gender, setGender] = useState<Gender | undefined>(user?.gender);
  const [categories, setCategories] = useState<string[]>(user?.categories || []);
  const [stateName, setStateName] = useState<string>(user?.state || '');
  const [districtType, setDistrictType] = useState<DistrictType | undefined>(user?.district_type);
  const [bizSituation, setBizSituation] = useState<'existing' | 'new'>(user?.business_situation || 'new');
  const [bizType, setBizType] = useState<BusinessType | undefined>(user?.business_type);
  const [customBiz, setCustomBiz] = useState<string>(user?.business_type_custom || '');
  const [incomeRange, setIncomeRange] = useState<string>(user?.income_range || '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAgeRange(user.age_range || '');
      setGender(user.gender);
      setCategories(user.categories || []);
      setStateName(user.state || '');
      setDistrictType(user.district_type);
      setBizSituation(user.business_situation || 'new');
      setBizType(user.business_type);
      setCustomBiz(user.business_type_custom || '');
      setIncomeRange(user.income_range || '');
    }
  }, [user]);

  const handleToggleCategory = (cat: string) => {
    if (cat === 'Prefer not to say') {
      setCategories(['Prefer not to say']);
      return;
    }
    const filtered = categories.filter((c) => c !== 'Prefer not to say');
    if (filtered.includes(cat)) {
      setCategories(filtered.filter((c) => c !== cat));
    } else {
      setCategories([...filtered, cat]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    const updates: Partial<UserRecord> = {
      name: name.trim() || user?.name,
      age_range: ageRange || undefined,
      gender,
      categories,
      state: stateName || null,
      district_type: districtType,
      business_situation: bizSituation,
      business_type: bizType,
      business_type_custom: customBiz || undefined,
      income_range: incomeRange || undefined,
    };

    await updateUserProfile(updates);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => navigateTo('landing')}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#004D40]/70 hover:text-[#004D40] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{language === 'hi' ? 'मुख्य पृष्ठ पर वापस' : 'Back to Home'}</span>
        </button>

        <button
          type="button"
          onClick={logout}
          className="touch-target px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{t.nav_logout}</span>
        </button>
      </div>

      <div className="bg-white border border-[#004D40]/15 rounded-2xl shadow-xs p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 mb-6 pb-5 border-b border-[#004D40]/10">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#004D40] flex items-center gap-2">
              <User className="w-5 h-5 text-[#FF6B35]" />
              <span>{t.profile_title}</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#004D40]/70 mt-1">
              {t.profile_subtitle}
            </p>
          </div>

          <div className="w-10 h-10 rounded-full bg-[#004D40]/10 flex items-center justify-center text-[#004D40] font-bold text-base shrink-0">
            {name ? name.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>

        {/* Success Toast */}
        {saveSuccess && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs sm:text-sm text-emerald-800 animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{t.profile_saved_success}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Read-only Phone & Name Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#004D40] mb-1.5">
                {t.signup_name_label}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#004D40]/20 text-sm focus:outline-none focus:border-[#004D40]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#004D40] mb-1.5">
                {t.signup_phone_label} (Registered)
              </label>
              <div className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500 font-mono">
                +91 {user?.phone_number}
              </div>
            </div>
          </div>

          {/* Age Range */}
          <div>
            <label className="block text-xs font-semibold text-[#004D40] mb-2">
              {t.label_age}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['18-25', '26-35', '36-45', '46+'].map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setAgeRange(range)}
                  className={`touch-target py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    ageRange === range
                      ? 'border-[#004D40] bg-[#004D40] text-white'
                      : 'border-[#004D40]/20 bg-white text-[#004D40]'
                  }`}
                >
                  {range} {language === 'hi' ? 'वर्ष' : 'years'}
                </button>
              ))}
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-semibold text-[#004D40] mb-2">
              {t.label_gender}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { val: 'female' as Gender, label: t.gender_female },
                { val: 'male' as Gender, label: t.gender_male },
                { val: 'transgender' as Gender, label: t.gender_transgender },
                { val: 'any' as Gender, label: t.gender_any },
              ].map((g) => (
                <button
                  key={g.val}
                  type="button"
                  onClick={() => setGender(g.val)}
                  className={`touch-target py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    gender === g.val
                      ? 'border-[#004D40] bg-[#004D40] text-white'
                      : 'border-[#004D40]/20 bg-white text-[#004D40]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Categories Multi-Select */}
          <div>
            <label className="block text-xs font-semibold text-[#004D40] mb-2">
              {t.step3_heading}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'SC', label: t.cat_sc },
                { val: 'ST', label: t.cat_st },
                { val: 'OBC', label: t.cat_obc },
                { val: 'Minority', label: t.cat_minority },
                { val: 'General', label: t.cat_general },
                { val: 'Woman', label: t.cat_woman },
                { val: 'Person with Disability', label: t.cat_pwd },
              ].map((cat) => {
                const isSelected = categories.includes(cat.val);
                return (
                  <button
                    key={cat.val}
                    type="button"
                    onClick={() => handleToggleCategory(cat.val)}
                    className={`touch-target p-2.5 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#004D40] bg-[#004D40]/10 text-[#004D40]'
                        : 'border-[#004D40]/20 bg-white text-gray-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* State & District Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#004D40] mb-1.5">
                {t.label_state}
              </label>
              <select
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#004D40]/20 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#004D40]"
              >
                <option value="">{t.select_state}</option>
                {INDIAN_STATES_AND_UTS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#004D40] mb-1.5">
                {t.label_district_type}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { val: 'rural' as DistrictType, label: 'Rural' },
                  { val: 'semi-urban' as DistrictType, label: 'Semi-Urban' },
                  { val: 'urban' as DistrictType, label: 'Urban' },
                ].map((area) => (
                  <button
                    key={area.val}
                    type="button"
                    onClick={() => setDistrictType(area.val)}
                    className={`touch-target py-2 px-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      districtType === area.val
                        ? 'border-[#004D40] bg-[#004D40] text-white'
                        : 'border-[#004D40]/20 bg-white text-[#004D40]'
                    }`}
                  >
                    {area.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Business Type */}
          <div>
            <label className="block text-xs font-semibold text-[#004D40] mb-1.5">
              {t.label_biz_type}
            </label>
            <select
              value={bizType || ''}
              onChange={(e) => setBizType((e.target.value || undefined) as BusinessType)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#004D40]/20 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#004D40]"
            >
              <option value="">Select business sector</option>
              <option value="textile_weaving">{t.biz_type_tailoring}</option>
              <option value="dairy_livestock">{t.biz_type_farming}</option>
              <option value="retail_shop">{t.biz_type_retail}</option>
              <option value="food_processing">{t.biz_type_food}</option>
              <option value="street_vendor">{t.biz_type_vendor}</option>
              <option value="artisan_handicraft">{t.biz_type_artisan}</option>
              <option value="services">{t.biz_type_services}</option>
              <option value="manufacturing">{t.biz_type_manufacturing}</option>
              <option value="any">{t.biz_type_other}</option>
            </select>
          </div>

          {/* Income Range */}
          <div>
            <label className="block text-xs font-semibold text-[#004D40] mb-1.5">
              {t.step6_heading}
            </label>
            <select
              value={incomeRange}
              onChange={(e) => setIncomeRange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#004D40]/20 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#004D40]"
            >
              <option value="">Select annual income bracket</option>
              <option value={t.income_below_1l}>{t.income_below_1l}</option>
              <option value={t.income_1_3l}>{t.income_1_3l}</option>
              <option value={t.income_3_6l}>{t.income_3_6l}</option>
              <option value={t.income_above_6l}>{t.income_above_6l}</option>
              <option value={t.income_prefer_not}>{t.income_prefer_not}</option>
            </select>
          </div>

          {/* Save Action */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="touch-target px-6 py-3 rounded-xl bg-[#FF6B35] hover:bg-[#e05a28] text-white font-bold text-sm flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{t.btn_save_changes}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
