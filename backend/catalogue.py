"""
Government catalogue provider for YojanaMatch.

Production data source: Open Government Data Platform India (data.gov.in).
Requires a real HTTP fetch via SCHEME_DATA_SOURCE_URL + DATA_GOV_IN_API_KEY.
Does NOT load schemes.json, scholarships.json, or catalogue_cache.json.
"""

from __future__ import annotations

import hashlib
import json
import os
import ssl
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from models import Scheme, SchemeBenefits, SchemeEligibility

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


class CatalogueNotConfiguredError(Exception):
    """Raised when DATA_GOV_IN_API_KEY or SCHEME_DATA_SOURCE_URL is missing."""


class CatalogueFetchError(Exception):
    """Raised when the configured government API request fails."""


# In-memory only — never persisted to a hand-authored JSON catalogue file.
_cached_schemes: List[Scheme] = []
_cached_scholarships: List[Scheme] = []
_catalogue_live: bool = False
_last_error: Optional[str] = None


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def is_catalogue_configured() -> bool:
    """True only when both government API env vars are set."""
    return bool(_env("SCHEME_DATA_SOURCE_URL") and _env("DATA_GOV_IN_API_KEY"))


def is_catalogue_live() -> bool:
    """True only after a successful external HTTP fetch + normalization."""
    return _catalogue_live


def catalogue_last_error() -> Optional[str]:
    return _last_error


def _pick(raw: Dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in raw and raw[key] not in (None, ""):
            return raw[key]
        # data.gov.in field names are often Title Case or snake_case
        for rk, rv in raw.items():
            if rk.lower().replace(" ", "_") == key.lower().replace(" ", "_") and rv not in (None, ""):
                return rv
    return default


def _stable_id(raw: Dict[str, Any], name: str) -> str:
    explicit = _pick(raw, "id", "scheme_code", "slug", "scheme_id", "resource_id")
    if explicit is not None:
        return str(explicit).strip().replace(" ", "_").lower()
    digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:12]
    return f"datagov_{digest}"


def _as_list(value: Any) -> Optional[List[str]]:
    if value is None:
        return None
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, str):
        parts = [p.strip() for p in value.replace("|", ",").split(",") if p.strip()]
        return parts or None
    return [str(value)]


def _parse_eligibility(raw: Dict[str, Any]) -> Optional[SchemeEligibility]:
    nested = raw.get("eligibility")
    src = nested if isinstance(nested, dict) else raw

    has_structured = any(
        k in src
        for k in (
            "min_age",
            "max_age",
            "allowed_genders",
            "allowed_castes",
            "allowed_district_types",
            "allowed_business_types",
            "max_income_inr",
            "education_levels",
            "minimum_marks_percentage",
            "course_types",
            "requires_differently_abled",
            "priority_groups",
        )
    )
    if not has_structured and nested is None:
        # Open-data rows often lack structured eligibility; leave open for matching.
        return SchemeEligibility()

    return SchemeEligibility(
        min_age=src.get("min_age", 18),
        max_age=src.get("max_age"),
        allowed_genders=_as_list(src.get("allowed_genders")) or ["any"],
        allowed_castes=_as_list(src.get("allowed_castes")) or ["any"],
        allowed_district_types=_as_list(src.get("allowed_district_types")) or ["any"],
        allowed_business_types=_as_list(src.get("allowed_business_types")) or ["any"],
        max_income_inr=src.get("max_income_inr"),
        priority_groups=_as_list(src.get("priority_groups")) or [],
        education_levels=_as_list(src.get("education_levels")),
        minimum_marks_percentage=src.get("minimum_marks_percentage"),
        course_types=_as_list(src.get("course_types")),
        requires_differently_abled=src.get("requires_differently_abled"),
    )


def _parse_benefits(raw: Dict[str, Any]) -> Optional[SchemeBenefits]:
    nested = raw.get("benefits")
    src = nested if isinstance(nested, dict) else raw
    max_loan = _pick(src, "max_loan_or_grant", "benefit_amount", "financial_assistance", "scholarship_amount")
    if not any(
        k in src
        for k in (
            "max_loan_or_grant",
            "benefit_percentage",
            "collateral_free",
            "scholarship_amount",
            "benefit_amount",
            "financial_assistance",
        )
    ) and nested is None:
        return None

    return SchemeBenefits(
        max_loan_or_grant=str(max_loan) if max_loan is not None else None,
        hindi_max_loan_or_grant=src.get("hindi_max_loan_or_grant"),
        benefit_percentage=str(src["benefit_percentage"]) if src.get("benefit_percentage") is not None else None,
        hindi_benefit_percentage=src.get("hindi_benefit_percentage"),
        collateral_free=src.get("collateral_free"),
        scholarship_amount=str(src["scholarship_amount"]) if src.get("scholarship_amount") is not None else None,
    )


def normalize_scheme_record(raw: Dict[str, Any]) -> Scheme:
    """
    Normalize one data.gov.in (or compatible) JSON record into the Scheme model.
    Only maps fields present in the payload — does not invent scheme facts.
    """
    if not isinstance(raw, dict):
        raise ValueError("Scheme record must be a JSON object")

    name = str(
        _pick(
            raw,
            "name",
            "scheme_name",
            "Scheme Name",
            "scheme_title",
            "title",
            default="Government Scheme",
        )
    )
    ministry = str(
        _pick(
            raw,
            "ministry",
            "nodal_ministry",
            "Ministry",
            "ministry_name",
            "department",
            default="Government of India",
        )
    )
    benefit_headline = str(
        _pick(
            raw,
            "benefit_headline",
            "benefit_summary",
            "benefits_summary",
            "scheme_benefit",
            default="Financial assistance & subsidy",
        )
    )
    short_summary = str(
        _pick(
            raw,
            "short_summary",
            "description",
            "scheme_description",
            "objective",
            "details",
            default=benefit_headline,
        )
    )
    official_link = str(
        _pick(
            raw,
            "official_link",
            "url",
            "application_link",
            "website",
            "portal_link",
            default="https://www.data.gov.in/",
        )
    )
    category = str(_pick(raw, "category", "scheme_type", "type", default="scheme")).lower()
    if "scholarship" in category or "scholarship" in name.lower():
        category = "scholarship"
    else:
        category = "scheme"

    applicable_states = _as_list(_pick(raw, "applicable_states", "state", "states")) or []
    category_tags = _as_list(_pick(raw, "category_tags", "tags", "keywords")) or []

    return Scheme(
        id=_stable_id(raw, name),
        name=name,
        hindi_name=_pick(raw, "hindi_name", "scheme_name_hi"),
        ministry=ministry,
        hindi_ministry=_pick(raw, "hindi_ministry"),
        benefit_headline=benefit_headline,
        hindi_benefit_headline=_pick(raw, "hindi_benefit_headline"),
        official_link=official_link,
        short_summary=short_summary,
        hindi_short_summary=_pick(raw, "hindi_short_summary"),
        category=category,
        eligibility=_parse_eligibility(raw),
        benefits=_parse_benefits(raw),
        applicable_states=applicable_states,
        popularity_score=raw.get("popularity_score"),
        date_added=_pick(raw, "date_added", "launch_date"),
        category_tags=category_tags,
    )


def _build_request_url(source_url: str, api_key: str) -> str:
    parsed = urllib.parse.urlparse(source_url)
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    if "api-key" not in query and "api_key" not in query:
        query["api-key"] = [api_key]
    if "format" not in query:
        query["format"] = ["json"]
    new_query = urllib.parse.urlencode(query, doseq=True)
    return urllib.parse.urlunparse(parsed._replace(query=new_query))


def _extract_records(body: Any) -> List[Dict[str, Any]]:
    if isinstance(body, list):
        return [item for item in body if isinstance(item, dict)]
    if not isinstance(body, dict):
        raise CatalogueFetchError("Government API returned non-JSON-object payload")

    for key in ("records", "schemes", "data", "results"):
        value = body.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]

    raise CatalogueFetchError(
        "Government API JSON did not contain a recognizable records list "
        "(expected keys: records, schemes, data, or results)"
    )


def fetch_remote_catalogue() -> List[Dict[str, Any]]:
    """
    Perform a real HTTP GET to SCHEME_DATA_SOURCE_URL with DATA_GOV_IN_API_KEY.
    """
    source_url = _env("SCHEME_DATA_SOURCE_URL")
    api_key = _env("DATA_GOV_IN_API_KEY")
    if not source_url or not api_key:
        raise CatalogueNotConfiguredError(
            "Government catalogue is not configured. "
            "Set DATA_GOV_IN_API_KEY and SCHEME_DATA_SOURCE_URL."
        )

    url = _build_request_url(source_url, api_key)
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "YojanaMatch/1.0 (+https://data.gov.in)",
            "Accept": "application/json",
        },
        method="GET",
    )
    ctx = ssl.create_default_context()

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            raw_bytes = resp.read()
            status = getattr(resp, "status", 200)
            if status != 200:
                raise CatalogueFetchError(f"Government API HTTP {status}")
    except CatalogueFetchError:
        raise
    except urllib.error.HTTPError as e:
        raise CatalogueFetchError(f"Government API HTTP {e.code}: {e.reason}") from e
    except Exception as e:
        raise CatalogueFetchError(f"Government API request failed: {e}") from e

    try:
        body = json.loads(raw_bytes.decode("utf-8"))
    except json.JSONDecodeError as e:
        raise CatalogueFetchError(f"Government API returned invalid JSON: {e}") from e

    records = _extract_records(body)
    if not records:
        raise CatalogueFetchError("Government API returned zero scheme records")
    return records


def _partition(records: List[Scheme]) -> Tuple[List[Scheme], List[Scheme]]:
    schemes: List[Scheme] = []
    scholarships: List[Scheme] = []
    for item in records:
        if (item.category or "").lower() == "scholarship" or "scholarship" in item.name.lower():
            scholarships.append(item)
        else:
            schemes.append(item)
    return schemes, scholarships


def load_catalogue(force_refresh: bool = False) -> Tuple[List[Scheme], List[Scheme]]:
    """
    Load catalogue exclusively from the configured data.gov.in HTTP endpoint.

    Returns (schemes, scholarships). Sets catalogue_live only after a successful fetch.
    Never reads schemes.json / scholarships.json / catalogue_cache.json.
    """
    global _cached_schemes, _cached_scholarships, _catalogue_live, _last_error

    if not is_catalogue_configured():
        _cached_schemes = []
        _cached_scholarships = []
        _catalogue_live = False
        _last_error = (
            "Government catalogue is not configured. "
            "Set DATA_GOV_IN_API_KEY and SCHEME_DATA_SOURCE_URL."
        )
        return [], []

    if _catalogue_live and not force_refresh and (_cached_schemes or _cached_scholarships):
        return _cached_schemes, _cached_scholarships

    try:
        raw_records = fetch_remote_catalogue()
        normalized = [normalize_scheme_record(item) for item in raw_records]
        schemes, scholarships = _partition(normalized)
        _cached_schemes = schemes
        _cached_scholarships = scholarships
        _catalogue_live = True
        _last_error = None
        print(
            f"Loaded {len(schemes)} schemes and {len(scholarships)} scholarships "
            f"from data.gov.in HTTP source."
        )
        return schemes, scholarships
    except (CatalogueNotConfiguredError, CatalogueFetchError) as e:
        _cached_schemes = []
        _cached_scholarships = []
        _catalogue_live = False
        _last_error = str(e)
        print(f"Catalogue load failed (no local fallback): {e}")
        return [], []


def reset_catalogue_state_for_tests() -> None:
    """Clear in-memory catalogue state (tests only)."""
    global _cached_schemes, _cached_scholarships, _catalogue_live, _last_error
    _cached_schemes = []
    _cached_scholarships = []
    _catalogue_live = False
    _last_error = None
