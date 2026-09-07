from typing import List
from models import Scheme, UserProfile, MatchedSchemeResult, MatchScoreDetail, SchemeEligibility

def match_schemes(
    profile: UserProfile,
    schemes: List[Scheme],
    category_type: str = "scheme"
) -> List[MatchedSchemeResult]:
    """
    Pure deterministic rule-based matching engine.
    Filters and ranks schemes based on the user's structured profile attributes.
    Matches frontend matchingEngine.ts feature parity with 90% max score ceiling.
    """
    results: List[MatchedSchemeResult] = []
    is_scholarship = (category_type == "scholarship")

    for scheme in schemes:
        details: List[MatchScoreDetail] = []
        is_disqualified = False
        match_points = 0
        total_criteria = 0

        el = scheme.eligibility or SchemeEligibility()

        # 1. Age Check
        if el.min_age is not None or el.max_age is not None:
            total_criteria += 1
            if profile.age is not None:
                min_ok = el.min_age is None or profile.age >= el.min_age
                max_ok = el.max_age is None or profile.age <= el.max_age
                matched = min_ok and max_ok
                if not matched:
                    is_disqualified = True
                else:
                    match_points += 2

                req_str = f"{el.min_age or 18} to {el.max_age} years" if el.max_age else f"{el.min_age or 18}+ years"
                details.append(MatchScoreDetail(
                    criteria="Age Requirement",
                    hindi_criteria="आयु आवश्यकता",
                    matched=matched,
                    user_value=f"{profile.age} years",
                    scheme_requirement=req_str
                ))
            else:
                match_points += 1
                details.append(MatchScoreDetail(
                    criteria="Age Requirement",
                    hindi_criteria="आयु आवश्यकता",
                    matched=True,
                    user_value="Not specified (Open)",
                    scheme_requirement=f"{el.min_age or 18}+ years"
                ))

        # 2. Gender Check
        if el.allowed_genders and "any" not in el.allowed_genders:
            total_criteria += 1
            if profile.gender and profile.gender != "any":
                matched = profile.gender in el.allowed_genders
                if not matched:
                    is_disqualified = True
                else:
                    match_points += 3
                user_val = "Female" if profile.gender == "female" else ("Male" if profile.gender == "male" else profile.gender)
                req_val = ", ".join(["Girls/Women" if g == "female" else g for g in el.allowed_genders])
                details.append(MatchScoreDetail(
                    criteria="Gender Eligibility",
                    hindi_criteria="लिंग पात्रता",
                    matched=matched,
                    user_value=user_val,
                    scheme_requirement=req_val
                ))
            else:
                match_points += 1
                details.append(MatchScoreDetail(
                    criteria="Gender Eligibility",
                    hindi_criteria="लिंग पात्रता",
                    matched=True,
                    user_value="All / Not specified",
                    scheme_requirement=", ".join(el.allowed_genders)
                ))
        else:
            if profile.gender and profile.gender != "any":
                match_points += 1

        # 3. Caste Category Check
        if el.allowed_castes and "any" not in el.allowed_castes and "general" not in el.allowed_castes:
            total_criteria += 1
            if profile.caste_category and profile.caste_category != "any":
                matched = profile.caste_category in el.allowed_castes
                if not matched:
                    is_disqualified = True
                else:
                    match_points += 3
                details.append(MatchScoreDetail(
                    criteria="Social Category",
                    hindi_criteria="सामाजिक श्रेणी (जाति)",
                    matched=matched,
                    user_value=profile.caste_category.upper(),
                    scheme_requirement=", ".join([c.upper() for c in el.allowed_castes])
                ))
            else:
                match_points += 1
                details.append(MatchScoreDetail(
                    criteria="Social Category",
                    hindi_criteria="सामाजिक श्रेणी (जाति)",
                    matched=True,
                    user_value="Open / Not specified",
                    scheme_requirement=", ".join([c.upper() for c in el.allowed_castes])
                ))
        else:
            if profile.caste_category:
                match_points += 1

        # 4. District / Location Type Check (schemes mode only)
        if not is_scholarship and el.allowed_district_types and "any" not in el.allowed_district_types:
            total_criteria += 1
            if profile.district_type and profile.district_type != "any":
                matched = profile.district_type in el.allowed_district_types
                if not matched:
                    is_disqualified = True
                else:
                    match_points += 2
                details.append(MatchScoreDetail(
                    criteria="Area / Location Type",
                    hindi_criteria="क्षेत्र / स्थान का प्रकार",
                    matched=matched,
                    user_value=profile.district_type,
                    scheme_requirement=" or ".join(el.allowed_district_types)
                ))
            else:
                match_points += 1
                details.append(MatchScoreDetail(
                    criteria="Area / Location Type",
                    hindi_criteria="क्षेत्र / स्थान का प्रकार",
                    matched=True,
                    user_value="Any / Not specified",
                    scheme_requirement=" or ".join(el.allowed_district_types)
                ))

        # 5. Business Type Check (schemes mode only)
        if not is_scholarship and el.allowed_business_types and "any" not in el.allowed_business_types:
            total_criteria += 1
            if profile.business_type and profile.business_type != "any":
                matched = profile.business_type in el.allowed_business_types
                if matched:
                    match_points += 4
                else:
                    if scheme.id in ["fisheries", "artisan_handicraft", "street_vendor"]:
                        is_disqualified = True
                details.append(MatchScoreDetail(
                    criteria="Business / Activity Sector",
                    hindi_criteria="व्यवसाय / कार्य क्षेत्र",
                    matched=matched,
                    user_value=profile.business_type.replace("_", " "),
                    scheme_requirement=", ".join([b.replace("_", " ") for b in el.allowed_business_types])
                ))
            else:
                match_points += 1

        # 6. Income Ceiling Check
        if el.max_income_inr is not None:
            total_criteria += 1
            if profile.estimated_income is not None:
                matched = profile.estimated_income <= el.max_income_inr
                if not matched:
                    is_disqualified = True
                else:
                    match_points += 3
                details.append(MatchScoreDetail(
                    criteria="Annual Family Income Ceiling",
                    hindi_criteria="वार्षिक पारिवारिक आय सीमा",
                    matched=matched,
                    user_value=f"₹{profile.estimated_income:,}",
                    scheme_requirement=f"Max ₹{el.max_income_inr:,}/year"
                ))
            else:
                match_points += 1
                details.append(MatchScoreDetail(
                    criteria="Annual Family Income Ceiling",
                    hindi_criteria="वार्षिक पारिवारिक आय सीमा",
                    matched=True,
                    user_value="Within limits / Not specified",
                    scheme_requirement=f"Max ₹{el.max_income_inr:,}/year"
                ))

        # 7. Education Level Check (scholarships mode only)
        if is_scholarship and el.education_levels and "any" not in el.education_levels:
            total_criteria += 1
            if profile.education_level and profile.education_level != "any":
                matched = profile.education_level in el.education_levels
                if not matched:
                    is_disqualified = True
                else:
                    match_points += 4
                details.append(MatchScoreDetail(
                    criteria="Education Level",
                    hindi_criteria="शिक्षा स्तर",
                    matched=matched,
                    user_value=profile.education_level,
                    scheme_requirement=", ".join(el.education_levels)
                ))
            else:
                match_points += 1
                details.append(MatchScoreDetail(
                    criteria="Education Level",
                    hindi_criteria="शिक्षा स्तर",
                    matched=True,
                    user_value="All levels / Not specified",
                    scheme_requirement=", ".join(el.education_levels)
                ))

        # 8. Minimum Marks Percentage Check (scholarships mode only)
        if is_scholarship and el.minimum_marks_percentage is not None:
            total_criteria += 1
            if profile.current_marks_percentage is not None:
                matched = profile.current_marks_percentage >= el.minimum_marks_percentage
                if not matched:
                    is_disqualified = True
                else:
                    match_points += 3
                details.append(MatchScoreDetail(
                    criteria="Minimum Marks Percentage",
                    hindi_criteria="न्यूनतम अंक प्रतिशत",
                    matched=matched,
                    user_value=f"{profile.current_marks_percentage}%",
                    scheme_requirement=f"Min {el.minimum_marks_percentage}% required"
                ))
            else:
                match_points += 1
                details.append(MatchScoreDetail(
                    criteria="Minimum Marks Percentage",
                    hindi_criteria="न्यूनतम अंक प्रतिशत",
                    matched=True,
                    user_value="Eligible / Not specified",
                    scheme_requirement=f"Min {el.minimum_marks_percentage}%"
                ))

        # 9. Course Type Check (scholarships mode only)
        if is_scholarship and el.course_types and "any" not in el.course_types:
            total_criteria += 1
            if profile.course_type and profile.course_type != "any":
                matched = profile.course_type in el.course_types
                if not matched:
                    is_disqualified = True
                else:
                    match_points += 3
                details.append(MatchScoreDetail(
                    criteria="Course Type / Stream",
                    hindi_criteria="पाठ्यक्रम वर्ग / स्ट्रीम",
                    matched=matched,
                    user_value=profile.course_type,
                    scheme_requirement=", ".join(el.course_types)
                ))
            else:
                match_points += 1
                details.append(MatchScoreDetail(
                    criteria="Course Type / Stream",
                    hindi_criteria="पाठ्यक्रम वर्ग / स्ट्रीम",
                    matched=True,
                    user_value="All Streams / Not specified",
                    scheme_requirement=", ".join(el.course_types)
                ))

        # 10. Differently-Abled Check
        if el.requires_differently_abled:
            total_criteria += 1
            if profile.is_differently_abled is not None:
                matched = bool(profile.is_differently_abled)
                if not matched:
                    is_disqualified = True
                else:
                    match_points += 4
                details.append(MatchScoreDetail(
                    criteria="Differently-Abled (Divyangjan)",
                    hindi_criteria="दिव्यांगजन पात्रता",
                    matched=matched,
                    user_value="Yes (Divyangjan)" if profile.is_differently_abled else "No",
                    scheme_requirement="Exclusively for Differently-Abled (PwD)"
                ))
            else:
                match_points += 1

        # 11. Priority Group Bonuses (Women, SC/ST, Minority, Rural)
        if el.priority_groups:
            if profile.gender == "female" and any(p.lower() in ["girl", "women"] or "girl" in p.lower() or "women" in p.lower() for p in el.priority_groups):
                match_points += 3
            if profile.caste_category in ["sc", "st"] and any("sc" in p.lower() or "st" in p.lower() or "tribal" in p.lower() for p in el.priority_groups):
                match_points += 3
            if profile.caste_category == "minority" and any("minority" in p.lower() for p in el.priority_groups):
                match_points += 3
            if profile.district_type == "rural" and any("rural" in p.lower() for p in el.priority_groups):
                match_points += 1

        # 12. State Relevance Bonus
        if profile.state and scheme.applicable_states:
            if profile.state in scheme.applicable_states:
                match_points += 2

        if not is_disqualified:
            matched_criteria_count = len([d for d in details if d.matched])
            max_possible_points = max(10, total_criteria * 3)
            raw_score = min(100, round((match_points / max_possible_points) * 100))
            adjusted_raw_score = raw_score if raw_score >= 60 else 60 + min(35, match_points * 4)
            # Option A: Rescale proportionally to 90% maximum ceiling
            rescaled_score = min(90, round(adjusted_raw_score * 0.90))

            results.append(MatchedSchemeResult(
                scheme=scheme,
                match_score=rescaled_score,
                matched_criteria_count=matched_criteria_count,
                total_criteria_checked=max(1, total_criteria),
                match_details=details
            ))

    # Sort results by matched_criteria_count descending, then match_score descending
    results.sort(key=lambda r: (r.matched_criteria_count, r.match_score), reverse=True)
    return results
