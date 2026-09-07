import React, { useState, useMemo } from 'react';
import {
  Edit2,
  X,
  Check,
  MapPin,
  Briefcase,
  GraduationCap,
  Coins,
  Users,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';
import { INDIAN_STATES_AND_UTS, userRecordToProfile } from '../lib/userProfileHelper';
import {
  UserProfile,
  Gender,
  CasteCategory,
  DistrictType,
  BusinessType,
  EducationLevel,
  CourseType,
} from '../types';

export const ProfileSummarySidebar: React.FC = () => {
  const {
    language,
    contentMode,
    extractedProfile,
    user,
    updateExtractedProfileAndRematch,
    isLoading,
  } = useAppStore();
  const t = translations[language];

  // Merge extractedProfile with user fallback
  const mergedProfile: UserProfile = useMemo(() => {
    const fromUser = userRecordToProfile(user);
    return {
      ...fromUser,
      ...extractedProfile,
    };
  }, [user, extractedProfile]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  // Form state for editing
  const [editAge, setEditAge] = useState<string>(
    mergedProfile.age ? String(mergedProfile.age) : ''
  );
  const [editGender, setEditGender] = useState<Gender>(mergedProfile.gender || 'any');
  const [editCaste, setEditCaste] = useState<CasteCategory>(mergedProfile.caste_category || 'any');
  const [editState, setEditState] = useState<string>(mergedProfile.state || '');
  const [editDistrictType, setEditDistrictType] = useState<DistrictType>(
    mergedProfile.district_type || 'any'
  );
  const [editBizType, setEditBizType] = useState<BusinessType>(
    mergedProfile.business_type || 'any'
  );
  const [editIncome, setEditIncome] = useState<string>(
    mergedProfile.estimated_income ? String(mergedProfile.estimated_income) : ''
  );
  // Scholarships specific fields
  const [editEduLevel, setEditEduLevel] = useState<EducationLevel>(
    mergedProfile.education_level || 'any'
  );
  const [editMarks, setEditMarks] = useState<string>(
    mergedProfile.current_marks_percentage ? String(mergedProfile.current_marks_percentage) : ''
  );
  const [editCourseType, setEditCourseType] = useState<CourseType>(
    mergedProfile.course_type || 'any'
  );

  const openEditModal = () => {
    setEditAge(mergedProfile.age ? String(mergedProfile.age) : '');
    setEditGender(mergedProfile.gender || 'any');
    setEditCaste(mergedProfile.caste_category || 'any');
    setEditState(mergedProfile.state || '');
    setEditDistrictType(mergedProfile.district_type || 'any');
    setEditBizType(mergedProfile.business_type || 'any');
    setEditIncome(mergedProfile.estimated_income ? String(mergedProfile.estimated_income) : '');
    setEditEduLevel(mergedProfile.education_level || 'any');
    setEditMarks(
      mergedProfile.current_marks_percentage ? String(mergedProfile.current_marks_percentage) : ''
    );
    setEditCourseType(mergedProfile.course_type || 'any');
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAge = editAge.trim() ? parseInt(editAge.trim(), 10) : null;
    const parsedIncome = editIncome.trim() ? parseInt(editIncome.trim(), 10) : null;
    const parsedMarks = editMarks.trim() ? parseFloat(editMarks.trim()) : null;

    const updates: Partial<UserProfile> = {
      age: parsedAge && !isNaN(parsedAge) ? parsedAge : undefined,
      gender: editGender !== 'any' ? editGender : undefined,
      caste_category: editCaste !== 'any' ? editCaste : undefined,
      state: editState.trim() ? editState.trim() : null,
      district_type: editDistrictType !== 'any' ? editDistrictType : undefined,
      business_type: editBizType !== 'any' ? editBizType : undefined,
      estimated_income: parsedIncome && !isNaN(parsedIncome) ? parsedIncome : null,
    };

    if (contentMode === 'scholarships') {
      updates.education_level = editEduLevel !== 'any' ? editEduLevel : undefined;
      updates.current_marks_percentage = parsedMarks && !isNaN(parsedMarks) ? parsedMarks : null;
      updates.course_type = editCourseType !== 'any' ? editCourseType : undefined;
    }

    setIsEditModalOpen(false);
    await updateExtractedProfileAndRematch(updates);
  };

  // Helper labels
  const formatGender = (g?: Gender) => {
    if (!g || g === 'any') return null;
    if (g === 'female') return language === 'hi' ? 'महिला (Female)' : 'Female';
    if (g === 'male') return language === 'hi' ? 'पुरुष (Male)' : 'Male';
    if (g === 'transgender') return language === 'hi' ? 'ट्रांसजेंडर (Transgender)' : 'Transgender';
    return null;
  };

  const formatCaste = (c?: CasteCategory) => {
    if (!c || c === 'any') return null;
    const map: Record<string, string> = {
      sc: 'SC',
      st: 'ST',
      obc: 'OBC',
      minority: language === 'hi' ? 'अल्पसंख्यक (Minority)' : 'Minority',
      general: language === 'hi' ? 'सामान्य (General)' : 'General',
      ews: 'EWS',
    };
    return map[c] || c.toUpperCase();
  };

  const formatDistrictType = (d?: DistrictType) => {
    if (!d || d === 'any') return null;
    if (d === 'rural') return language === 'hi' ? 'ग्रामीण (Rural)' : 'Rural';
    if (d === 'urban') return language === 'hi' ? 'शहरी (Urban)' : 'Urban';
    if (d === 'semi-urban') return language === 'hi' ? 'कस्बा/अर्ध-शहरी (Semi-Urban)' : 'Semi-Urban';
    return null;
  };

  const formatBusinessType = (b?: BusinessType) => {
    if (!b || b === 'any') return null;
    const map: Record<string, string> = {
      textile_weaving: language === 'hi' ? 'सिलाई / वस्त्र' : 'Tailoring & Textiles',
      dairy_livestock: language === 'hi' ? 'डेयरी / पशुपालन' : 'Dairy & Livestock',
      retail_shop: language === 'hi' ? 'दुकान / खुदरा' : 'Retail Store',
      food_processing: language === 'hi' ? 'खाद्य प्रसंस्करण' : 'Food Processing',
      street_vendor: language === 'hi' ? 'स्ट्रीट वेंडर / फेरी' : 'Street Vendor',
      artisan_handicraft: language === 'hi' ? 'हस्तशिल्प / कारीगर' : 'Artisan & Craft',
      services: language === 'hi' ? 'सेवाएं' : 'Services',
      manufacturing: language === 'hi' ? 'उत्पादन / विनिर्माण' : 'Small Manufacturing',
    };
    return map[b] || b.replace('_', ' ');
  };

  const formatIncome = (inc?: number | null) => {
    if (inc == null || inc === undefined || inc <= 0) return null;
    if (inc <= 100000) return '< ₹1 Lakh';
    if (inc <= 300000) return '₹1 - 3 Lakhs';
    if (inc <= 600000) return '₹3 - 6 Lakhs';
    return '₹' + inc.toLocaleString('en-IN');
  };

  // Compile active non-empty fields to display
  const profileItems: { label: string; value: string; icon: React.ReactNode }[] = [];

  // Age
  if (mergedProfile.age) {
    profileItems.push({
      label: language === 'hi' ? 'आयु' : 'Age',
      value: `${mergedProfile.age} ${language === 'hi' ? 'वर्ष' : 'years'}`,
      icon: <Users className="w-3.5 h-3.5 text-[#004D40]/60" />,
    });
  }

  // Social Category & Gender
  const casteStr = formatCaste(mergedProfile.caste_category);
  const genderStr = formatGender(mergedProfile.gender);
  if (casteStr || genderStr) {
    const combined = [casteStr, genderStr].filter(Boolean).join(', ');
    profileItems.push({
      label: language === 'hi' ? 'श्रेणी एवं जेंडर' : 'Category',
      value: combined,
      icon: <Users className="w-3.5 h-3.5 text-[#004D40]/60" />,
    });
  }

  // Location
  const stateStr = mergedProfile.state || null;
  const areaStr = formatDistrictType(mergedProfile.district_type);
  if (stateStr || areaStr) {
    const combined = [stateStr, areaStr].filter(Boolean).join(', ');
    profileItems.push({
      label: language === 'hi' ? 'स्थान' : 'Location',
      value: combined,
      icon: <MapPin className="w-3.5 h-3.5 text-[#004D40]/60" />,
    });
  }

  // Business or Education
  if (contentMode === 'scholarships') {
    const edu = mergedProfile.education_level && mergedProfile.education_level !== 'any'
      ? mergedProfile.education_level
      : null;
    const course = mergedProfile.course_type && mergedProfile.course_type !== 'any'
      ? mergedProfile.course_type
      : null;
    const marks = mergedProfile.current_marks_percentage
      ? `${mergedProfile.current_marks_percentage}%`
      : null;
    const scholarshipDetails = [edu, course, marks].filter(Boolean).join(' • ');
    if (scholarshipDetails) {
      profileItems.push({
        label: language === 'hi' ? 'शिक्षा एवं अध्ययन' : 'Education',
        value: scholarshipDetails,
        icon: <GraduationCap className="w-3.5 h-3.5 text-[#004D40]/60" />,
      });
    }
  } else {
    const bizStr = formatBusinessType(mergedProfile.business_type);
    if (bizStr) {
      profileItems.push({
        label: language === 'hi' ? 'उद्यम' : 'Business',
        value: bizStr,
        icon: <Briefcase className="w-3.5 h-3.5 text-[#004D40]/60" />,
      });
    }
  }

  // Income
  const incomeStr = formatIncome(mergedProfile.estimated_income);
  if (incomeStr) {
    profileItems.push({
      label: language === 'hi' ? 'वार्षिक आय' : 'Annual Income',
      value: incomeStr,
      icon: <Coins className="w-3.5 h-3.5 text-[#004D40]/60" />,
    });
  }

  return (
    <>
      {/* ================= DESKTOP/TABLET SIDEBAR (>= 900px) ================= */}
      <aside className="hidden min-[900px]:block w-full sticky top-20 self-start">
        <div className="bg-white rounded-2xl border border-[#004D40]/15 shadow-xs p-5 sm:p-6 space-y-4">
          {/* Header & Edit Action */}
          <div className="flex items-center justify-between border-b border-[#004D40]/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#004D40]/10 text-[#004D40] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#FF6B35]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#004D40]">
                  {language === 'hi' ? 'यह परिणाम क्यों' : 'Why these results'}
                </h3>
                <p className="text-[11px] text-[#004D40]/60 font-medium">
                  {language === 'hi' ? 'आपकी मिलान प्रोफाइल' : 'Your match profile'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openEditModal}
              disabled={isLoading}
              className="touch-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#004D40]/5 hover:bg-[#FF6B35] hover:text-white text-xs font-bold text-[#004D40] transition-colors cursor-pointer disabled:opacity-50"
              title="Edit profile to refine matches"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'संपादित करें' : 'Edit'}</span>
            </button>
          </div>

          {/* Profile Facts List */}
          {profileItems.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-[#004D40]/60">
                {language === 'hi'
                  ? 'सामान्य पात्रता के आधार पर परिणाम दिखाए जा रहे हैं।'
                  : 'Showing results matching general criteria.'}
              </p>
              <button
                type="button"
                onClick={openEditModal}
                className="mt-2 text-xs font-bold text-[#FF6B35] hover:underline cursor-pointer"
              >
                + {language === 'hi' ? 'प्रोफाइल विवरण जोड़ें' : 'Add profile details'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {profileItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-[#004D40]/5 border border-[#004D40]/10 space-y-0.5"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#004D40]/70 uppercase tracking-wider">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-[#004D40] pl-5">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom hint */}
          <div className="pt-2 text-[11px] text-[#004D40]/55 leading-tight flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>
              {language === 'hi'
                ? 'नियम-आधारित इंजन आपकी प्रोफाइल का सत्यापन करता है।'
                : 'Deterministic matching based on verified criteria.'}
            </span>
          </div>
        </div>
      </aside>

      {/* ================= MOBILE COLLAPSIBLE ACCORDION (< 900px) ================= */}
      <div className="block min-[900px]:hidden w-full mb-4">
        <div className="bg-white rounded-xl border border-[#004D40]/15 shadow-2xs overflow-hidden">
          <div className="p-3.5 flex items-center justify-between gap-3 bg-[#004D40]/5">
            <button
              type="button"
              onClick={() => setIsMobileExpanded(!isMobileExpanded)}
              className="flex items-center gap-2 text-left flex-1 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#FF6B35] shrink-0" />
              <div className="text-xs font-bold text-[#004D40]">
                {language === 'hi' ? 'आपकी प्रोफाइल (मिलान आधार)' : 'Your Profile (Why these matches)'}
              </div>
              {isMobileExpanded ? (
                <ChevronUp className="w-4 h-4 text-[#004D40]/60 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#004D40]/60 shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={openEditModal}
              disabled={isLoading}
              className="touch-target px-2.5 py-1 rounded-lg bg-white border border-[#004D40]/20 text-xs font-bold text-[#004D40] flex items-center gap-1 hover:bg-[#FF6B35] hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <Edit2 className="w-3 h-3" />
              <span>{language === 'hi' ? 'बदलें' : 'Edit'}</span>
            </button>
          </div>

          {/* Compact summary badges when collapsed */}
          {!isMobileExpanded && profileItems.length > 0 && (
            <div className="px-3 py-2 flex flex-wrap gap-1.5 border-t border-[#004D40]/10">
              {profileItems.slice(0, 3).map((item, idx) => (
                <span
                  key={idx}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#004D40]/5 text-[#004D40] border border-[#004D40]/10"
                >
                  {item.label}: <strong className="font-bold">{item.value}</strong>
                </span>
              ))}
              {profileItems.length > 3 && (
                <span className="text-[11px] text-[#004D40]/60 font-medium self-center">
                  +{profileItems.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Expanded items list on mobile */}
          {isMobileExpanded && (
            <div className="p-3.5 space-y-2 border-t border-[#004D40]/10 bg-white">
              {profileItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 border-b border-[#004D40]/5 last:border-b-0"
                >
                  <span className="text-[#004D40]/70 font-medium">{item.label}</span>
                  <span className="font-bold text-[#004D40]">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= LIGHTWEIGHT INLINE EDIT MODAL ================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#004D40]/15 shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#004D40]/10 flex items-center justify-between bg-[#FAFAF7]">
              <div>
                <h3 className="text-lg font-bold text-[#004D40]">
                  {language === 'hi' ? 'प्रोफाइल विवरण अपडेट करें' : 'Update Profile Details'}
                </h3>
                <p className="text-xs text-[#004D40]/65 mt-0.5">
                  {language === 'hi'
                    ? 'अपडेट के बाद परिणाम तुरंत पुनः मिलाए जाएंगे।'
                    : 'Changes will automatically update your ranked results.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="touch-target p-2 rounded-xl text-[#004D40]/60 hover:text-[#004D40] hover:bg-[#004D40]/10 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProfile} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Age */}
              <div>
                <label className="block text-xs font-bold text-[#004D40] uppercase tracking-wider mb-1.5">
                  {language === 'hi' ? 'आयु (वर्ष)' : 'Age (years)'}
                </label>
                <input
                  type="number"
                  min={14}
                  max={99}
                  value={editAge}
                  onChange={(e) => setEditAge(e.target.value)}
                  placeholder="e.g. 28"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#004D40]/20 text-sm focus:outline-none focus:border-[#004D40]"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-bold text-[#004D40] uppercase tracking-wider mb-1.5">
                  {language === 'hi' ? 'जेंडर' : 'Gender'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'female' as Gender, label: language === 'hi' ? 'महिला' : 'Female' },
                    { val: 'male' as Gender, label: language === 'hi' ? 'पुरुष' : 'Male' },
                    { val: 'any' as Gender, label: language === 'hi' ? 'सभी / कोई भी' : 'Any' },
                  ].map((g) => (
                    <button
                      key={g.val}
                      type="button"
                      onClick={() => setEditGender(g.val)}
                      className={`touch-target py-2 px-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        editGender === g.val
                          ? 'bg-[#004D40] text-white border-[#004D40]'
                          : 'bg-white text-[#004D40] border-[#004D40]/20 hover:bg-[#004D40]/5'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Social Category */}
              <div>
                <label className="block text-xs font-bold text-[#004D40] uppercase tracking-wider mb-1.5">
                  {language === 'hi' ? 'सामाजिक श्रेणी' : 'Social Category'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['sc', 'st', 'obc', 'minority', 'general', 'any'] as CasteCategory[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditCaste(c)}
                      className={`touch-target py-2 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer uppercase ${
                        editCaste === c
                          ? 'bg-[#004D40] text-white border-[#004D40]'
                          : 'bg-white text-[#004D40] border-[#004D40]/20 hover:bg-[#004D40]/5'
                      }`}
                    >
                      {c === 'minority' ? (language === 'hi' ? 'अल्पसंख्यक' : 'Minority') : c}
                    </button>
                  ))}
                </div>
              </div>

              {/* State & Area Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#004D40] uppercase tracking-wider mb-1.5">
                    {language === 'hi' ? 'राज्य' : 'State'}
                  </label>
                  <select
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#004D40]/20 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#004D40]"
                  >
                    <option value="">{language === 'hi' ? 'राज्य चुनें' : 'All States'}</option>
                    {INDIAN_STATES_AND_UTS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#004D40] uppercase tracking-wider mb-1.5">
                    {language === 'hi' ? 'क्षेत्र' : 'Area Type'}
                  </label>
                  <select
                    value={editDistrictType}
                    onChange={(e) => setEditDistrictType(e.target.value as DistrictType)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#004D40]/20 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#004D40]"
                  >
                    <option value="any">{language === 'hi' ? 'सभी क्षेत्र' : 'Any'}</option>
                    <option value="rural">{language === 'hi' ? 'ग्रामीण (Rural)' : 'Rural'}</option>
                    <option value="semi-urban">{language === 'hi' ? 'कस्बा (Semi-Urban)' : 'Semi-Urban'}</option>
                    <option value="urban">{language === 'hi' ? 'शहरी (Urban)' : 'Urban'}</option>
                  </select>
                </div>
              </div>

              {/* Mode Specific: Schemes vs Scholarships */}
              {contentMode === 'scholarships' ? (
                <div className="space-y-3 pt-1 border-t border-[#004D40]/10">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#004D40] uppercase tracking-wider mb-1.5">
                        {language === 'hi' ? 'शिक्षा स्तर' : 'Education Level'}
                      </label>
                      <select
                        value={editEduLevel}
                        onChange={(e) => setEditEduLevel(e.target.value as EducationLevel)}
                        className="w-full px-3 py-2 rounded-xl border border-[#004D40]/20 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#004D40]"
                      >
                        <option value="any">Any Level</option>
                        <option value="school">School / 10th / 12th</option>
                        <option value="undergraduate">Undergraduate (UG)</option>
                        <option value="postgraduate">Postgraduate (PG)</option>
                        <option value="diploma">Diploma / ITI</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#004D40] uppercase tracking-wider mb-1.5">
                        {language === 'hi' ? 'अंक प्रतिशत' : 'Marks %'}
                      </label>
                      <input
                        type="number"
                        min={35}
                        max={100}
                        value={editMarks}
                        onChange={(e) => setEditMarks(e.target.value)}
                        placeholder="e.g. 75"
                        className="w-full px-3 py-2 rounded-xl border border-[#004D40]/20 text-xs sm:text-sm focus:outline-none focus:border-[#004D40]"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-[#004D40] uppercase tracking-wider mb-1.5">
                    {language === 'hi' ? 'उद्यम क्षेत्र' : 'Business Sector'}
                  </label>
                  <select
                    value={editBizType}
                    onChange={(e) => setEditBizType(e.target.value as BusinessType)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#004D40]/20 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#004D40]"
                  >
                    <option value="any">{language === 'hi' ? 'सभी व्यवसाय' : 'Any'}</option>
                    <option value="textile_weaving">{t.biz_type_tailoring}</option>
                    <option value="dairy_livestock">{t.biz_type_farming}</option>
                    <option value="retail_shop">{t.biz_type_retail}</option>
                    <option value="food_processing">{t.biz_type_food}</option>
                    <option value="street_vendor">{t.biz_type_vendor}</option>
                    <option value="artisan_handicraft">{t.biz_type_artisan}</option>
                    <option value="services">{t.biz_type_services}</option>
                    <option value="manufacturing">{t.biz_type_manufacturing}</option>
                  </select>
                </div>
              )}

              {/* Annual Income */}
              <div>
                <label className="block text-xs font-bold text-[#004D40] uppercase tracking-wider mb-1.5">
                  {language === 'hi' ? 'अनुमानित वार्षिक आय (₹)' : 'Annual Income (₹, approx)'}
                </label>
                <input
                  type="number"
                  step={10000}
                  value={editIncome}
                  onChange={(e) => setEditIncome(e.target.value)}
                  placeholder="e.g. 150000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#004D40]/20 text-sm focus:outline-none focus:border-[#004D40]"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-[#004D40]/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="touch-target px-4 py-2.5 rounded-xl border border-[#004D40]/20 text-xs sm:text-sm font-semibold text-[#004D40] hover:bg-[#004D40]/5 cursor-pointer"
                >
                  {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="touch-target px-5 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#E8551F] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{language === 'hi' ? 'लागू करें और पुनः मिलाएं' : 'Apply & Rematch'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
