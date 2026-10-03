"""Unit tests for deterministic initial-milestone generation (no DB)."""

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from app.models.offer import Offer
from app.services.contract_service import (
    MAX_MILESTONES,
    _due_dates,
    _milestone_titles,
    _split_amount,
    initial_milestones,
)

NOW = datetime(2026, 10, 3, 9, 0, 0)


def _offer(**overrides) -> Offer:
    payload = dict(
        id=uuid.uuid4(),
        ask_id=uuid.uuid4(),
        provider_id=uuid.uuid4(),
        price=Decimal("450"),
        currency="INR",
        delivery_days=6,
        pitch="A pitch that is definitely long enough for validation.",
        deliverables=["Draft", "Final files", "Handoff"],
        created_at=NOW,
    )
    payload.update(overrides)
    return Offer(**payload)


def test_split_is_even_with_remainder_on_final_milestone():
    parts = _split_amount(Decimal("100"), 3)
    assert parts == [
        Decimal("33.33"),
        Decimal("33.33"),
        Decimal("33.34"),
    ]
    assert sum(parts) == Decimal("100")


def test_split_even_amount_has_no_remainder():
    parts = _split_amount(Decimal("450"), 3)
    assert parts == [Decimal("150")] * 3


def test_split_keeps_penny_precision():
    parts = _split_amount(Decimal("0.01"), 3)
    assert sum(parts) == Decimal("0.01")
    assert parts[-1] == Decimal("0.01")


def test_due_dates_spread_across_delivery_window():
    dues = _due_dates(date(2026, 10, 3), 6, 3)
    assert dues == [
        date(2026, 10, 5),
        date(2026, 10, 7),
        date(2026, 10, 9),
    ]
    assert _due_dates(date(2026, 10, 3), 1, 1) == [date(2026, 10, 4)]


def test_titles_take_up_to_three_deliverables():
    assert _milestone_titles(["One", "Two", "Three", "Four"]) == [
        "One",
        "Two",
        "Three",
    ]
    assert _milestone_titles([]) == ["Project delivery"]
    assert _milestone_titles(None) == ["Project delivery"]
    assert _milestone_titles(["  spaced   out  "]) == ["spaced out"]
    assert _milestone_titles(["Same", "Same"]) == ["Same"]


def test_initial_milestones_are_deterministic():
    milestones = initial_milestones(_offer())
    assert len(milestones) == MAX_MILESTONES
    assert [m.position for m in milestones] == [0, 1, 2]
    assert [m.title for m in milestones] == ["Draft", "Final files", "Handoff"]
    assert all(m.status.value == "upcoming" for m in milestones)
    assert all(m.description is None for m in milestones)
    assert sum(m.amount for m in milestones) == Decimal("450")
    assert [m.due_date for m in milestones] == [
        date(2026, 10, 5),
        date(2026, 10, 7),
        date(2026, 10, 9),
    ]

    # Same input, same output — no randomness anywhere.
    again = initial_milestones(_offer())
    assert [(m.title, m.amount, m.due_date) for m in again] == [
        (m.title, m.amount, m.due_date) for m in milestones
    ]


def test_initial_milestones_single_fallback():
    milestones = initial_milestones(_offer(deliverables=[], price=Decimal("75")))
    assert len(milestones) == 1
    assert milestones[0].title == "Project delivery"
    assert milestones[0].amount == Decimal("75")
    assert milestones[0].due_date == NOW.date() + timedelta(days=6)
