import type { AppLanguage, ContentMode, Scheme } from '../types';

export type DocId =
  | 'aadhaar'
  | 'caste_certificate'
  | 'income_certificate'
  | 'disability_certificate'
  | 'marksheet'
  | 'admission_proof'
  | 'project_report'
  | 'vendor_proof'
  | 'bank_passbook'
  | 'passport_photo';

export const DOC_LABELS: Record<DocId, Record<AppLanguage, string>> = {
  aadhaar: {
    en: 'Aadhaar card',
    hi: 'आधार कार्ड',
    mr: 'आधार कार्ड',
    te: 'ఆధార్ కార్డు',
  },
  caste_certificate: {
    en: 'Caste certificate (SC / ST / OBC)',
    hi: 'जाति प्रमाण पत्र (SC / ST / OBC)',
    mr: 'जात प्रमाणपत्र (SC / ST / OBC)',
    te: 'కుల ధృవీకరణ పత్రం (SC / ST / OBC)',
  },
  income_certificate: {
    en: 'Income proof / certificate',
    hi: 'आय प्रमाण पत्र',
    mr: 'उत्पन्नाचा दाखला',
    te: 'ఆదాయ ధృవీకరణ పత్రం',
  },
  disability_certificate: {
    en: 'Disability certificate',
    hi: 'दिव्यांगता प्रमाण पत्र',
    mr: 'दिव्यांगत्व प्रमाणपत्र',
    te: 'వైకల్య ధృవీకరణ పత్రం',
  },
  marksheet: {
    en: 'Latest marksheet',
    hi: 'पिछली कक्षा की अंकतालिका',
    mr: 'मागील वर्गाची गुणपत्रिका',
    te: 'చివరి మార్కుల జాబితా',
  },
  admission_proof: {
    en: 'Admission proof (college ID or bonafide)',
    hi: 'प्रवेश प्रमाण (कॉलेज आईडी या बोनाफाइड)',
    mr: 'प्रवेशाचा पुरावा (कॉलेज ओळखपत्र किंवा बोनाफाईड)',
    te: 'ప్రవేశ ధృవీకరణ (కళాశాల ఐడీ లేదా బోనఫైడ్)',
  },
  project_report: {
    en: 'Business plan / project report',
    hi: 'व्यवसाय योजना / परियोजना रिपोर्ट',
    mr: 'व्यवसाय आराखडा / प्रकल्प अहवाल',
    te: 'వ్యాపార ప్రణాళిక / ప్రాజెక్ట్ నివేదిక',
  },
  vendor_proof: {
    en: 'Street vendor certificate or ID card',
    hi: 'रेहड़ी-पटरी विक्रेता प्रमाण पत्र या पहचान पत्र',
    mr: 'फेरीवाला प्रमाणपत्र किंवा ओळखपत्र',
    te: 'వీధి వ్యాపారి ధృవీకరణ పత్రం లేదా గుర్తింపు కార్డు',
  },
  bank_passbook: {
    en: 'Bank passbook (account number and IFSC)',
    hi: 'बैंक पासबुक (खाता संख्या और IFSC)',
    mr: 'बँक पासबुक (खाते क्रमांक आणि IFSC)',
    te: 'బ్యాంకు పాస్‌బుక్ (ఖాతా సంఖ్య మరియు IFSC)',
  },
  passport_photo: {
    en: 'Passport-size photo',
    hi: 'पासपोर्ट साइज़ फोटो',
    mr: 'पासपोर्ट आकाराचा फोटो',
    te: 'పాస్‌పోర్ట్ సైజు ఫోటో',
  },
};

// Schemes that usually need a written plan or report along with the application.
const PROJECT_REPORT_SCHEMES = ['pmegp', 'standup_india', 'pm_mudra', 'cgtmse'];

export function getDocsForScheme(scheme: Scheme, contentMode: ContentMode): DocId[] {
  const e = scheme.eligibility || {};
  const docs: DocId[] = ['aadhaar'];

  const castes = e.allowed_castes || [];
  const casteRestricted = castes.length > 0 && !castes.includes('any');
  const prio = e.priority_groups || [];
  const hasCastePriority = prio.some((g) => ['SC/ST', 'SC', 'ST', 'OBC'].includes(g));
  if (casteRestricted || hasCastePriority) docs.push('caste_certificate');

  if (e.max_income_inr) docs.push('income_certificate');
  if (e.requires_differently_abled) docs.push('disability_certificate');

  const isEducation =
    contentMode === 'scholarships' ||
    (e.education_levels && e.education_levels.length > 0) ||
    !!e.minimum_marks_percentage;
  if (isEducation) {
    docs.push('marksheet');
    docs.push('admission_proof');
  }

  if (PROJECT_REPORT_SCHEMES.includes(scheme.id)) docs.push('project_report');
  if (scheme.id === 'pm_svanidhi') docs.push('vendor_proof');

  docs.push('bank_passbook');
  docs.push('passport_photo');
  return docs;
}
