from typing import List
from models import Scheme, UserProfile, MatchedSchemeResult, MatchScoreDetail

def match_schemes(profile: UserProfile, schemes: List[Scheme]) -> List[MatchedSchemeResult]:
    """
    Pure deterministic rule-based matching engine.
    Matches schemes against user profile attributes.
    Zero external dependencies, purely unit testable.
    """
    results: List[MatchedSchemeResult] = []

    for scheme in schemes:
        details: List[MatchScoreDetail] = []
        is_disqualified = False
        match_points = 0
        total_criteria = 0

        el = scheme.eligibility

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
                details.append(MatchScoreDetail(
                    criteria="Age Requirement",
                    hindi_criteria="आयु आवश्यकता",
                    matched=matched,
                    user_value=f"{profile.age} years",
                    scheme_requirement=f"{el.min_age or 18}+ years" if not el.max_age else f"{el.min_age or 18} to {el.max_age} years"
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
                details.append(MatchScoreDetail(
                    criteria="Gender Eligibility",
                    hindi_criteria="लिंग पात्रता",
                    matched=matched,
                    user_value=profile.gender,
                    scheme_requirement=", ".join(el.allowed_genders)
                ))
            else:
                match_points += 1
                details.append(MatchScoreDetail(
                    criteria="Gender Eligibility",
                    hindi_criteria="लिंग पात्रता",
                    matched=True,
                    user_value="All genders / Wildcard",
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
                    criteria="Social Category (Caste)",
                    hindi_criteria="सामाजिक श्रेणी (जाति)",
                    matched=matched,
                    user_value=profile.caste_category.upper(),
                    scheme_requirement=", ".join([c.upper() for c in el.allowed_castes])
                ))
            else:
                match_points += 1
                details.append(MatchScoreDetail(
                    criteria="Social Category (Caste)",
                    hindi_criteria="सामाजिक श्रेणी (जाति)",
                    matched=True,
                    user_value="Open / Wildcard",
                    scheme_requirement=", ".join([c.upper() for c in el.allowed_castes])
                ))
        else:
            if profile.caste_category:
                match_points += 1

        # 4. District Type Check
        if el.allowed_district_types and "any" not in el.allowed_district_types:
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
                    user_value="Any / Wildcard",
                    scheme_requirement=" or ".join(el.allowed_district_types)
                ))

        # 5. Business Type Check
        if el.allowed_business_types and "any" not in el.allowed_business_types:
            total_criteria += 1
            if profile.business_type and profile.business_type != "any":
                matched = profile.business_type in el.allowed_business_types
                if matched:
                    match_points += 4
                else:
                    if scheme.id in ["fisheries", "artisan_handicraft", "street_vendor"]:
                        is_disqualified = True
                details.append(MatchScoreDetail(
                    criteria="Business Sector",
                    hindi_criteria="व्यवसाय क्षेत्र",
                    matched=matched,
                    user_value=profile.business_type.replace("_", " "),
                    scheme_requirement=", ".join([b.replace("_", " ") for b in el.allowed_business_types])
                ))
            else:
                match_points += 1

        # 6. Income Check
        if el.max_income_inr is not None:
            total_criteria += 1
            if profile.estimated_income is not None:
                matched = profile.estimated_income <= el.max_income_inr
                if not matched:
                    is_disqualified = True
                else:
                    match_points += 2
                details.append(MatchScoreDetail(
                    criteria="Annual Income Ceiling",
                    hindi_criteria="वार्षिक आय सीमा",
                    matched=matched,
                    user_value=f"₹{profile.estimated_income:,}",
                    scheme_requirement=f"Max ₹{el.max_income_inr:,}/year"
                ))
            else:
                match_points += 1
                details.append(MatchScoreDetail(
                    criteria="Annual Income Ceiling",
                    hindi_criteria="वार्षिक आय सीमा",
                    matched=True,
                    user_value="Within limit / Wildcard",
                    scheme_requirement=f"Max ₹{el.max_income_inr:,}/year"
                ))

        # Priority Group Bonus
        if el.priority_groups:
            if profile.gender == "female" and any("women" in p.lower() for p in el.priority_groups):
                match_points += 2
            if profile.caste_category in ["sc", "st"] and any("sc" in p.lower() or "st" in p.lower() for p in el.priority_groups):
                match_points += 2
            if profile.district_type == "rural" and any("rural" in p.lower() for p in el.priority_groups):
                match_points += 1

        if not is_disqualified:
            matched_criteria_count = len([d for d in details if d.matched])
            max_points = max(10, total_criteria * 3)
            score = min(100, int((match_points / max_points) * 100))
            final_score = score if score >= 60 else 60 + min(35, match_points * 4)
            # Option A: Rescale proportionally to 90% maximum ceiling
            rescaled_score = min(90, round(final_score * 0.90))

            results.append(MatchedSchemeResult(
                scheme=scheme,
                match_score=rescaled_score,
                matched_criteria_count=matched_criteria_count,
                total_criteria_checked=max(1, total_criteria),
                match_details=details
            ))

    # Rank results by matched criteria count descending, then match score descending
    results.sort(key=lambda r: (r.matched_criteria_count, r.match_score), reverse=True)
    return results
