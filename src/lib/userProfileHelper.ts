import { CasteCategory, DistrictType, BusinessType, Gender, UserProfile, UserRecord } from '../types';

export function userRecordToProfile(user?: UserRecord | null): UserProfile {
  if (!user) return {};

  let estimated_income: number | null = user.estimated_income ?? null;
  if (estimated_income == null && user.income_range) {
    if (user.income_range.includes('Below ₹1L')) estimated_income = 80000;
    else if (user.income_range.includes('₹1-3L')) estimated_income = 200000;
    else if (user.income_range.includes('₹3-6L')) estimated_income = 450000;
    else if (user.income_range.includes('Above ₹6L')) estimated_income = 800000;
  }

  let age: number | null = user.age ?? null;
  if (age == null && user.age_range) {
    if (user.age_range === '18-25') age = 22;
    else if (user.age_range === '26-35') age = 30;
    else if (user.age_range === '36-45') age = 40;
    else if (user.age_range === '46+') age = 52;
  }

  let caste: CasteCategory | undefined = user.caste_category;
  if (!caste && user.categories && user.categories.length > 0) {
    if (user.categories.includes('SC')) caste = 'sc';
    else if (user.categories.includes('ST')) caste = 'st';
    else if (user.categories.includes('OBC')) caste = 'obc';
    else if (user.categories.includes('Minority')) caste = 'minority';
    else if (user.categories.includes('General')) caste = 'general';
  }

  let is_differently_abled = user.is_differently_abled;
  if (is_differently_abled === undefined && user.categories) {
    is_differently_abled = user.categories.includes('Person with Disability');
  }

  let gender = user.gender;
  if (!gender && user.categories && user.categories.includes('Woman')) {
    gender = 'female';
  }

  return {
    age,
    gender,
    caste_category: caste,
    state: user.state || null,
    district_type: user.district_type,
    business_type: user.business_type,
    estimated_income,
    is_differently_abled,
    education_level: user.education_level,
    current_marks_percentage: user.current_marks_percentage,
    course_type: user.course_type,
  };
}

export const INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

export const DID_YOU_KNOW_FACTS = [
  {
    en: "Under PMEGP, women, SC/ST, and OBC entrepreneurs in rural areas receive up to 35% project cost covered by direct government support on projects up to ₹50 Lakhs.",
    hi: "PMEGP के तहत, ग्रामीण क्षेत्रों में महिला, एससी/एसटी और ओबीसी उद्यमियों को ₹50 लाख तक की परियोजना लागत पर 35% तक प्रत्यक्ष सरकारी वित्तीय सहायता मिलती है।",
    schemeId: "pmegp",
  },
  {
    en: "PM SVANidhi offers collateral-free loans starting at ₹10,000 up to ₹50,000 for street vendors with a 7% interest benefit and up to ₹1,200 annual digital cashback.",
    hi: "पीएम स्वनिधि रेहड़ी-पटरी विक्रेताओं को 7% ब्याज अनुदान और ₹1,200 वार्षिक कैशबैक के साथ ₹10,000 से ₹50,000 तक का बिना गारंटी ऋण देती है।",
    schemeId: "pm_svanidhi",
  },
  {
    en: "Stand-Up India mandates every commercial bank branch to sanction loans between ₹10 Lakh and ₹1 Crore to at least one SC or ST borrower and at least one woman.",
    hi: "स्टैंड-अप इंडिया के तहत प्रत्येक बैंक शाखा के लिए कम से कम एक एससी/एसटी और एक महिला उद्यमी को ₹10 लाख से ₹1 करोड़ का ऋण देना अनिवार्य है।",
    schemeId: "standup_india",
  },
  {
    en: "PM Vishwakarma provides traditional artisans and craftspersons a ₹15,000 modern toolkit grant plus collateral-free enterprise loans up to ₹3 Lakhs at only 5% interest.",
    hi: "पीएम विश्वकर्मा पारंपरिक कारीगरों को ₹15,000 का आधुनिक टूलकिट अनुदान और केवल 5% ब्याज पर ₹3 लाख तक का बिना गारंटी ऋण प्रदान करती है।",
    schemeId: "pm_vishwakarma",
  },
  {
    en: "CGTMSE guarantees up to 85% to 100% of collateral-free bank loans up to ₹5 Crores for women, SC/ST, and micro-enterprises in aspirational districts.",
    hi: "CGTMSE महिला, एससी/एसटी और आकांक्षी जिलों के सूक्ष्म उद्यमियों के लिए ₹5 करोड़ तक के बैंक ऋण पर 85% से 100% तक सरकारी गारंटी प्रदान करता है।",
    schemeId: "cgtmse",
  },
  {
    en: "Mahila Samridhi Yojana provides micro-finance credit up to ₹1,40,000 at a concessional 4% annual interest rate for women from underprivileged communities.",
    hi: "महिला समृद्धि योजना पिछड़े वर्ग व वंचित समुदाय की महिलाओं को स्वरोजगार हेतु मात्र 4% वार्षिक रियायती ब्याज दर पर ₹1,40,000 तक का ऋण देती है।",
    schemeId: "mahila_samridhi_yojana",
  },
];

export const DID_YOU_KNOW_SCHOLARSHIP_FACTS = [
  {
    en: "The AICTE Pragati Scholarship awards ₹50,000 every single year to girl students admitted to technical degrees and diplomas across India.",
    hi: "एआईसीटीई प्रगति छात्रवृत्ति योजना भारत भर में तकनीकी डिग्री और डिप्लोमा में प्रवेश लेने वाली छात्राओं को हर साल ₹50,000 प्रदान करती है।",
    schemeId: "aicte_pragati",
  },
  {
    en: "Under the Post-Matric SC/ST Scholarship, 100% of non-refundable college and university fees are reimbursed directly to the student or institution by DBT.",
    hi: "पोस्ट-मैट्रिक एससी/एसटी छात्रवृत्ति के तहत 100% अनिवार्य गैर-वापसी योग्य कॉलेज फीस डीबीटी के माध्यम से सीधे छात्र या संस्थान को दी जाती है।",
    schemeId: "post_matric_sc",
  },
  {
    en: "The National Means-Cum-Merit Scholarship (NMMSS) awards ₹12,000/year from Class 9 to 12 (Total ₹48,000) to stop dropouts among economically weaker students.",
    hi: "राष्ट्रीय साधन-सह-योग्यता छात्रवृत्ति (NMMSS) आर्थिक रूप से कमजोर छात्रों को कक्षा 9 से 12 तक ₹12,000/वर्ष (कुल ₹48,000) देती है।",
    schemeId: "nmmss",
  },
  {
    en: "The Central Sector Scheme (CSSS) supports 82,000 top-ranking college and university students nationwide with up to ₹20,000 per year.",
    hi: "केंद्रीय क्षेत्र छात्रवृत्ति (CSSS) देश भर के 82,000 शीर्ष मेधावी कॉलेज और विश्वविद्यालय छात्रों को ₹20,000 प्रति वर्ष तक देती है।",
    schemeId: "central_sector_csss",
  },
  {
    en: "The AICTE Saksham Scholarship provides ₹50,000 annually for tuition and specialized study aids to differently-abled students with 40%+ disability.",
    hi: "एआईसीटीई सक्षम छात्रवृत्ति 40% या अधिक दिव्यांगता वाले विद्यार्थियों को तकनीकी शिक्षा हेतु ₹50,000 वार्षिक सहायता देती है।",
    schemeId: "aicte_saksham",
  },
  {
    en: "The Begum Hazrat Mahal National Scholarship provides direct bank transfers up to ₹6,000 for minority girl students studying in Classes 9 to 12.",
    hi: "बेगम हज़रत महल राष्ट्रीय छात्रवृत्ति कक्षा 9 से 12 में पढ़ रही अल्पसंख्यक छात्राओं को ₹6,000 तक का प्रत्यक्ष बैंक खाता अनुदान देती है।",
    schemeId: "begum_hazrat_mahal",
  },
];
