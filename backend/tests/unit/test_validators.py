"""Canonical category taxonomy — pinned to API_CONTRACT.md (ASK `category`)
and mirrored by the frontend's src/mocks/categories.js label list."""

import pytest

from app.utils.validators import (
    ALLOWED_CATEGORIES,
    normalize_categories,
    normalize_category,
)

# The exact canonical set from API_CONTRACT.md. The frontend mirrors these
# labels in src/mocks/categories.js; both sides must stay in lockstep.
CONTRACT_CATEGORIES = (
    "Design",
    "Writing",
    "Development",
    "Photography",
    "Marketing",
    "Tutoring",
    "Events",
)


def test_allowed_categories_match_the_frozen_contract():
    assert ALLOWED_CATEGORIES == CONTRACT_CATEGORIES


@pytest.mark.parametrize(
    ("raw", "canonical"),
    [
        ("marketing", "Marketing"),
        ("MARKETING", "Marketing"),
        (" Design ", "Design"),
        ("development", "Development"),
    ],
)
def test_normalize_category_is_case_insensitive(raw: str, canonical: str):
    assert normalize_category(raw) == canonical


@pytest.mark.parametrize(
    "retired",
    ["Home services", "home services", "Errands", "errands"],
)
def test_retired_legacy_categories_are_rejected(retired: str):
    with pytest.raises(ValueError, match="Invalid category"):
        normalize_category(retired)


def test_unknown_category_is_rejected():
    with pytest.raises(ValueError, match="Invalid category"):
        normalize_category("Hacking")


def test_normalize_categories_dedupes_and_preserves_order():
    assert normalize_categories(["marketing", "Marketing", "Design"]) == [
        "Marketing",
        "Design",
    ]


def test_normalize_categories_enforces_item_limit():
    with pytest.raises(ValueError, match="At most 10"):
        normalize_categories(["Design"] * 11)
