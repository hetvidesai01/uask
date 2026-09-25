"""Fixed value lists shared by Ask and User schemas."""

ALLOWED_CATEGORIES: tuple[str, ...] = (
    "Design",
    "Writing",
    "Development",
    "Home services",
    "Photography",
    "Tutoring",
    "Events",
    "Errands",
)

_CATEGORY_BY_KEY = {c.lower(): c for c in ALLOWED_CATEGORIES}


def normalize_category(value: str) -> str:
    """Match case-insensitively; return the canonical label or raise."""
    canonical = _CATEGORY_BY_KEY.get(value.strip().lower())
    if canonical is None:
        allowed = ", ".join(ALLOWED_CATEGORIES)
        raise ValueError(f"Invalid category. Allowed: {allowed}")
    return canonical


def normalize_categories(values: list[str]) -> list[str]:
    """Normalize, dedupe (order-preserving), enforce ≤10 items each ≤40 chars."""
    if len(values) > 10:
        raise ValueError("At most 10 categories are allowed.")
    seen: set[str] = set()
    result: list[str] = []
    for raw in values:
        if len(raw) > 40:
            raise ValueError("Each category must be at most 40 characters.")
        canonical = normalize_category(raw)
        if canonical not in seen:
            seen.add(canonical)
            result.append(canonical)
    return result
