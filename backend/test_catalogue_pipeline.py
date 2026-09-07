"""
Prove: mocked data.gov.in HTTP JSON → normalize → deterministic matching.
No local schemes.json / scholarships.json / catalogue_cache.json is used.
"""

from __future__ import annotations

import json
import os
import unittest
from unittest.mock import patch
from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from catalogue import (
    load_catalogue,
    normalize_scheme_record,
    is_catalogue_configured,
    is_catalogue_live,
    reset_catalogue_state_for_tests,
)
from matching import match_schemes
from models import UserProfile


MOCK_DATA_GOV_RESPONSE = {
    "status": "ok",
    "total": 2,
    "count": 2,
    "records": [
        {
            "scheme_name": "SC Women Rural Enterprise Support Scheme",
            "ministry_name": "Ministry of Social Justice and Empowerment",
            "scheme_description": "Credit support for SC women entrepreneurs in rural areas.",
            "benefit_summary": "Collateral-free loan up to ₹10 Lakh",
            "website": "https://www.data.gov.in/",
            "category": "scheme",
            "state": "Haryana",
            "eligibility": {
                "min_age": 18,
                "allowed_genders": ["female"],
                "allowed_castes": ["sc"],
                "allowed_district_types": ["rural"],
                "allowed_business_types": ["artisan_handicraft", "retail_shop"],
                "max_income_inr": 800000,
                "priority_groups": ["women", "sc", "rural"],
            },
            "benefits": {
                "max_loan_or_grant": "₹10 Lakh",
                "collateral_free": True,
            },
        },
        {
            "scheme_name": "National Merit Scholarship for Undergraduate Students",
            "ministry_name": "Ministry of Education",
            "scheme_description": "Merit scholarship for undergraduate students.",
            "benefit_summary": "Annual scholarship grant",
            "website": "https://scholarships.gov.in/",
            "category": "scholarship",
            "eligibility": {
                "min_age": 17,
                "max_age": 30,
                "allowed_genders": ["any"],
                "allowed_castes": ["any"],
                "education_levels": ["undergraduate"],
                "minimum_marks_percentage": 60,
                "course_types": ["any"],
                "max_income_inr": 500000,
            },
            "benefits": {
                "scholarship_amount": "₹12,000 / year",
            },
        },
    ],
}


class FakeHTTPResponse:
    def __init__(self, payload: dict, status: int = 200):
        self._payload = payload
        self.status = status

    def read(self):
        return json.dumps(self._payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class CataloguePipelineTests(unittest.TestCase):
    def setUp(self):
        reset_catalogue_state_for_tests()
        self._old_env = {
            "DATA_GOV_IN_API_KEY": os.environ.get("DATA_GOV_IN_API_KEY"),
            "SCHEME_DATA_SOURCE_URL": os.environ.get("SCHEME_DATA_SOURCE_URL"),
        }

    def tearDown(self):
        reset_catalogue_state_for_tests()
        for key, value in self._old_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def test_unconfigured_is_not_live(self):
        os.environ.pop("DATA_GOV_IN_API_KEY", None)
        os.environ.pop("SCHEME_DATA_SOURCE_URL", None)
        schemes, scholarships = load_catalogue(force_refresh=True)
        self.assertFalse(is_catalogue_configured())
        self.assertFalse(is_catalogue_live())
        self.assertEqual(schemes, [])
        self.assertEqual(scholarships, [])

    def test_external_json_normalize_then_match(self):
        os.environ["DATA_GOV_IN_API_KEY"] = "test-api-key"
        os.environ["SCHEME_DATA_SOURCE_URL"] = (
            "https://api.data.gov.in/resource/example-resource-id?format=json&limit=100"
        )

        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_urlopen.return_value = FakeHTTPResponse(MOCK_DATA_GOV_RESPONSE)
            schemes, scholarships = load_catalogue(force_refresh=True)

            # Prove a real HTTP request path was invoked
            self.assertTrue(mock_urlopen.called)
            request_obj = mock_urlopen.call_args[0][0]
            requested_url = request_obj.full_url if hasattr(request_obj, "full_url") else str(request_obj)
            self.assertIn("api.data.gov.in", requested_url)
            self.assertIn("api-key=test-api-key", requested_url)

        self.assertTrue(is_catalogue_configured())
        self.assertTrue(is_catalogue_live())
        self.assertEqual(len(schemes), 1)
        self.assertEqual(len(scholarships), 1)
        self.assertEqual(schemes[0].name, "SC Women Rural Enterprise Support Scheme")
        self.assertEqual(schemes[0].eligibility.allowed_castes, ["sc"])

        profile = UserProfile(
            age=28,
            gender="female",
            caste_category="sc",
            state="Haryana",
            district_type="rural",
            business_type="artisan_handicraft",
            estimated_income=200000,
        )
        results = match_schemes(profile, schemes, category_type="scheme")
        self.assertGreaterEqual(len(results), 1)
        self.assertEqual(results[0].scheme.id, schemes[0].id)
        self.assertGreaterEqual(results[0].match_score, 60)
        self.assertLessEqual(results[0].match_score, 90)

        # Ensure legacy JSON files were not opened as the production source
        self.assertFalse(any("schemes.json" in str(c) for c in mock_urlopen.call_args_list))

    def test_normalize_maps_data_gov_field_aliases(self):
        raw = {
            "Scheme Name": "Sample Central Scheme",
            "Ministry": "Ministry of MSME",
            "description": "Support for micro enterprises",
            "url": "https://msme.gov.in/",
        }
        scheme = normalize_scheme_record(raw)
        self.assertEqual(scheme.name, "Sample Central Scheme")
        self.assertEqual(scheme.ministry, "Ministry of MSME")
        self.assertIn("micro enterprises", scheme.short_summary)
        self.assertEqual(scheme.official_link, "https://msme.gov.in/")


if __name__ == "__main__":
    unittest.main()
