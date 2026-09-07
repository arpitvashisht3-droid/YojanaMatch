import { Scheme, UserProfile, MatchedSchemeResult, MatchScoreDetail } from '../types';

/**
 * Pure deterministic rule-based matching engine.
 * Filters and ranks schemes based on the user's structured profile attributes.
 * Zero external API calls, pure function.
 */
export function matchSchemes(
  profile: UserProfile,
  schemes: Scheme[],
  category_type: 'scheme' | 'scholarship' = 'scheme'
): MatchedSchemeResult[] {
  const results: MatchedSchemeResult[] = [];
  const isScholarship = category_type === 'scholarship';

  for (const scheme of schemes) {
    const details: MatchScoreDetail[] = [];
    let isDisqualified = false;
    let matchPoints = 0;
    let totalCriteria = 0;

    const { eligibility } = scheme;

    // 1. Age Check
    if (eligibility.min_age !== undefined || eligibility.max_age !== undefined) {
      totalCriteria++;
      if (profile.age != null) {
        const minOk = eligibility.min_age === undefined || profile.age >= eligibility.min_age;
        const maxOk = eligibility.max_age === undefined || profile.age <= eligibility.max_age;
        const matched = minOk && maxOk;
        
        if (!matched) {
          isDisqualified = true;
        } else {
          matchPoints += 2;
        }

        details.push({
          criteria: 'Age Requirement',
          hindi_criteria: 'आयु आवश्यकता',
          matched,
          user_value: `${profile.age} years`,
          scheme_requirement: eligibility.max_age 
            ? `${eligibility.min_age || 18} to ${eligibility.max_age} years` 
            : `${eligibility.min_age || 18}+ years`,
        });
      } else {
        // Wildcard / not specified: neutral match
        matchPoints += 1;
        details.push({
          criteria: 'Age Requirement',
          hindi_criteria: 'आयु आवश्यकता',
          matched: true,
          user_value: 'Not specified (Open)',
          scheme_requirement: `${eligibility.min_age || 18}+ years`,
        });
      }
    }

    // 2. Gender Check
    if (eligibility.allowed_genders && !eligibility.allowed_genders.includes('any')) {
      totalCriteria++;
      if (profile.gender && profile.gender !== 'any') {
        const matched = eligibility.allowed_genders.includes(profile.gender);
        if (!matched) {
          isDisqualified = true;
        } else {
          matchPoints += 3; // high weight for gender-specific schemes/scholarships
        }
        details.push({
          criteria: 'Gender Eligibility',
          hindi_criteria: 'लिंग पात्रता',
          matched,
          user_value: profile.gender === 'female' ? 'Female' : profile.gender === 'male' ? 'Male' : profile.gender,
          scheme_requirement: eligibility.allowed_genders.map(g => g === 'female' ? 'Girls/Women' : g).join(', '),
        });
      } else {
        // Wildcard
        matchPoints += 1;
        details.push({
          criteria: 'Gender Eligibility',
          hindi_criteria: 'लिंग पात्रता',
          matched: true,
          user_value: 'All / Not specified',
          scheme_requirement: eligibility.allowed_genders.join(', '),
        });
      }
    } else {
      if (profile.gender && profile.gender !== 'any') {
        matchPoints += 1;
      }
    }

    // 3. Caste Category Check
    if (eligibility.allowed_castes && !eligibility.allowed_castes.includes('any') && !eligibility.allowed_castes.includes('general')) {
      totalCriteria++;
      if (profile.caste_category && profile.caste_category !== 'any') {
        const matched = eligibility.allowed_castes.includes(profile.caste_category);
        if (!matched) {
          isDisqualified = true;
        } else {
          matchPoints += 3;
        }
        details.push({
          criteria: 'Social Category',
          hindi_criteria: 'सामाजिक श्रेणी (जाति)',
          matched,
          user_value: profile.caste_category.toUpperCase(),
          scheme_requirement: eligibility.allowed_castes.map(c => c.toUpperCase()).join(', '),
        });
      } else {
        matchPoints += 1;
        details.push({
          criteria: 'Social Category',
          hindi_criteria: 'सामाजिक श्रेणी (जाति)',
          matched: true,
          user_value: 'Open / Not specified',
          scheme_requirement: eligibility.allowed_castes.map(c => c.toUpperCase()).join(', '),
        });
      }
    } else {
      if (profile.caste_category) {
        matchPoints += 1;
      }
    }

    // 4. District / Location Type Check (primarily for schemes, optional for scholarships)
    if (!isScholarship && eligibility.allowed_district_types && !eligibility.allowed_district_types.includes('any')) {
      totalCriteria++;
      if (profile.district_type && profile.district_type !== 'any') {
        const matched = eligibility.allowed_district_types.includes(profile.district_type);
        if (!matched) {
          isDisqualified = true;
        } else {
          matchPoints += 2;
        }
        details.push({
          criteria: 'Area / Location Type',
          hindi_criteria: 'क्षेत्र / स्थान का प्रकार',
          matched,
          user_value: profile.district_type,
          scheme_requirement: eligibility.allowed_district_types.join(' or '),
        });
      } else {
        matchPoints += 1;
        details.push({
          criteria: 'Area / Location Type',
          hindi_criteria: 'क्षेत्र / स्थान का प्रकार',
          matched: true,
          user_value: 'Any / Not specified',
          scheme_requirement: eligibility.allowed_district_types.join(' or '),
        });
      }
    }

    // 5. Business Type Check (Schemes mode only)
    if (!isScholarship && eligibility.allowed_business_types && !eligibility.allowed_business_types.includes('any')) {
      totalCriteria++;
      if (profile.business_type && profile.business_type !== 'any') {
        const matched = eligibility.allowed_business_types.includes(profile.business_type);
        if (matched) {
          matchPoints += 4;
        } else {
          if (['fisheries', 'artisan_handicraft', 'street_vendor'].includes(scheme.id)) {
            isDisqualified = true;
          }
        }
        details.push({
          criteria: 'Business / Activity Sector',
          hindi_criteria: 'व्यवसाय / कार्य क्षेत्र',
          matched,
          user_value: profile.business_type.replace('_', ' '),
          scheme_requirement: eligibility.allowed_business_types.map(b => b.replace('_', ' ')).join(', '),
        });
      } else {
        matchPoints += 1;
      }
    }

    // 6. Income Ceiling Check
    if (eligibility.max_income_inr !== undefined) {
      totalCriteria++;
      if (profile.estimated_income != null) {
        const matched = profile.estimated_income <= eligibility.max_income_inr;
        if (!matched) {
          isDisqualified = true;
        } else {
          matchPoints += 3;
        }
        details.push({
          criteria: 'Annual Family Income Ceiling',
          hindi_criteria: 'वार्षिक पारिवारिक आय सीमा',
          matched,
          user_value: `₹${profile.estimated_income.toLocaleString('en-IN')}`,
          scheme_requirement: `Max ₹${eligibility.max_income_inr.toLocaleString('en-IN')}/year`,
        });
      } else {
        matchPoints += 1;
        details.push({
          criteria: 'Annual Family Income Ceiling',
          hindi_criteria: 'वार्षिक पारिवारिक आय सीमा',
          matched: true,
          user_value: 'Within limits / Not specified',
          scheme_requirement: `Max ₹${eligibility.max_income_inr.toLocaleString('en-IN')}/year`,
        });
      }
    }

    // 7. Education Level Check (Scholarships mode)
    if (isScholarship && eligibility.education_levels && !eligibility.education_levels.includes('any')) {
      totalCriteria++;
      if (profile.education_level && profile.education_level !== 'any') {
        const matched = eligibility.education_levels.includes(profile.education_level);
        if (!matched) {
          isDisqualified = true;
        } else {
          matchPoints += 4;
        }
        details.push({
          criteria: 'Education Level',
          hindi_criteria: 'शिक्षा स्तर',
          matched,
          user_value: profile.education_level,
          scheme_requirement: eligibility.education_levels.join(', '),
        });
      } else {
        matchPoints += 1;
        details.push({
          criteria: 'Education Level',
          hindi_criteria: 'शिक्षा स्तर',
          matched: true,
          user_value: 'All levels / Not specified',
          scheme_requirement: eligibility.education_levels.join(', '),
        });
      }
    }

    // 8. Minimum Marks Percentage Check (Scholarships mode)
    if (isScholarship && eligibility.minimum_marks_percentage !== undefined) {
      totalCriteria++;
      if (profile.current_marks_percentage != null) {
        const matched = profile.current_marks_percentage >= eligibility.minimum_marks_percentage;
        if (!matched) {
          isDisqualified = true;
        } else {
          matchPoints += 3;
        }
        details.push({
          criteria: 'Minimum Marks Percentage',
          hindi_criteria: 'न्यूनतम अंक प्रतिशत',
          matched,
          user_value: `${profile.current_marks_percentage}%`,
          scheme_requirement: `Min ${eligibility.minimum_marks_percentage}% required`,
        });
      } else {
        matchPoints += 1;
        details.push({
          criteria: 'Minimum Marks Percentage',
          hindi_criteria: 'न्यूनतम अंक प्रतिशत',
          matched: true,
          user_value: 'Eligible / Not specified',
          scheme_requirement: `Min ${eligibility.minimum_marks_percentage}%`,
        });
      }
    }

    // 9. Course Type Check (Scholarships mode)
    if (isScholarship && eligibility.course_types && !eligibility.course_types.includes('any')) {
      totalCriteria++;
      if (profile.course_type && profile.course_type !== 'any') {
        const matched = eligibility.course_types.includes(profile.course_type);
        if (!matched) {
          isDisqualified = true;
        } else {
          matchPoints += 3;
        }
        details.push({
          criteria: 'Course Type / Stream',
          hindi_criteria: 'पाठ्यक्रम वर्ग / स्ट्रीम',
          matched,
          user_value: profile.course_type,
          scheme_requirement: eligibility.course_types.join(', '),
        });
      } else {
        matchPoints += 1;
        details.push({
          criteria: 'Course Type / Stream',
          hindi_criteria: 'पाठ्यक्रम वर्ग / स्ट्रीम',
          matched: true,
          user_value: 'All Streams / Not specified',
          scheme_requirement: eligibility.course_types.join(', '),
        });
      }
    }

    // 10. Differently-Abled Check
    if (eligibility.requires_differently_abled) {
      totalCriteria++;
      if (profile.is_differently_abled !== undefined) {
        const matched = Boolean(profile.is_differently_abled);
        if (!matched) {
          isDisqualified = true;
        } else {
          matchPoints += 4;
        }
        details.push({
          criteria: 'Differently-Abled (Divyangjan)',
          hindi_criteria: 'दिव्यांगजन पात्रता',
          matched,
          user_value: profile.is_differently_abled ? 'Yes (Divyangjan)' : 'No',
          scheme_requirement: 'Exclusively for Differently-Abled (PwD)',
        });
      } else {
        matchPoints += 1;
      }
    }

    // 11. Priority Group Bonuses (Women, SC/ST, Merit, etc.)
    if (eligibility.priority_groups && eligibility.priority_groups.length > 0) {
      if (profile.gender === 'female' && eligibility.priority_groups.some(p => p.toLowerCase().includes('girl') || p.toLowerCase().includes('women'))) {
        matchPoints += 3;
      }
      if (['sc', 'st'].includes(profile.caste_category || '') && eligibility.priority_groups.some(p => p.toLowerCase().includes('sc') || p.toLowerCase().includes('st') || p.toLowerCase().includes('tribal'))) {
        matchPoints += 3;
      }
      if (profile.caste_category === 'minority' && eligibility.priority_groups.some(p => p.toLowerCase().includes('minority'))) {
        matchPoints += 3;
      }
      if (profile.district_type === 'rural' && eligibility.priority_groups.some(p => p.toLowerCase().includes('rural'))) {
        matchPoints += 1;
      }
    }

    // 12. State Relevance Bonus
    if (profile.state && scheme.applicable_states && scheme.applicable_states.length > 0) {
      if (scheme.applicable_states.includes(profile.state)) {
        matchPoints += 2;
      }
    }

    if (!isDisqualified) {
      const matchedCriteriaCount = details.filter(d => d.matched).length;
      const maxPossiblePoints = Math.max(10, totalCriteria * 3);
      const rawScore = Math.min(100, Math.round((matchPoints / maxPossiblePoints) * 100));
      const adjustedRawScore = rawScore >= 60 ? rawScore : 60 + Math.min(35, matchPoints * 4);
      // Option A: Proportional rescaling to max 90% ceiling (no scheme shows 100%)
      const rescaledScore = Math.min(90, Math.round(adjustedRawScore * 0.90));

      results.push({
        scheme,
        match_score: rescaledScore,
        matched_criteria_count: matchedCriteriaCount,
        total_criteria_checked: Math.max(1, totalCriteria),
        match_details: details,
      });
    }
  }

  // Sort results by matched_criteria_count (highest first), then by match_score descending
  return results.sort((a, b) => {
    if (b.matched_criteria_count !== a.matched_criteria_count) {
      return b.matched_criteria_count - a.matched_criteria_count;
    }
    return b.match_score - a.match_score;
  });
}
