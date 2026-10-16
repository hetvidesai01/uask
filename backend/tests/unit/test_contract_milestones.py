"""Unit tests for deterministic 25/50/25 payment-stage generation (no DB)."""

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from app.models.offer import Offer
from app.services.contract_service import (
    _split_25_50_25,
    _stage_due_dates,
    initial_stages,
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


def test_split_is_25_50_with_remainder_on_final():
    parts = _split_25_50_25(Decimal("100"))
    assert parts == [Decimal("25.00"), Decimal("50.00"), Decimal("25.00")]
    assert sum(parts) == Decimal("100")


def test_split_remainder_lands_on_final():
    # 447 * 0.25 = 111.75; 447 * 0.50 = 223.50; remainder 111.75.
    parts = _split_25_50_25(Decimal("447"))
    assert parts == [Decimal("111.75"), Decimal("223.50"), Decimal("111.75")]
    assert sum(parts) == Decimal("447")


def test_split_always_sums_to_total():
    for raw in ("0.01", "0.07", "9.99", "123.45", "1000", "450"):
        total = Decimal(raw)
        parts = _split_25_50_25(total)
        assert sum(parts) == total, raw


def test_split_penny_precision_no_shortfall():
    parts = _split_25_50_25(Decimal("0.01"))
    assert sum(parts) == Decimal("0.01")
    # initial (0.0025) rounds to 0.00; progress (0.005) rounds up to 0.01;
    # final takes the (zero) remainder. The total is never short.
    assert parts[0] == Decimal("0.00")
    assert parts[1] == Decimal("0.01")
    assert parts[2] == Decimal("0.00")


def test_due_dates_spread_across_delivery_window():
    dues = _stage_due_dates(date(2026, 10, 3), 6)
    assert dues == [
        date(2026, 10, 5),
        date(2026, 10, 7),
        date(2026, 10, 9),
    ]
    assert _stage_due_dates(date(2026, 10, 3), 1) == [date(2026, 10, 4)] * 3


def test_initial_stages_are_deterministic_25_50_25():
    stages = initial_stages(_offer())
    assert len(stages) == 3
    assert [m.position for m in stages] == [0, 1, 2]
    assert [m.kind.value for m in stages] == ["initial", "progress", "final"]
    assert [m.title for m in stages] == [
        "Initial payment (25%)",
        "Progress payment (50%)",
        "Final payment (25%)",
    ]
    assert all(m.status.value == "not_due" for m in stages)
    assert all(m.description is None for m in stages)
    assert sum(m.amount for m in stages) == Decimal("450")
    assert [m.amount for m in stages] == [
        Decimal("112.50"),
        Decimal("225.00"),
        Decimal("112.50"),
    ]
    assert [m.due_date for m in stages] == [
        date(2026, 10, 5),
        date(2026, 10, 7),
        date(2026, 10, 9),
    ]

    # Same input, same output — no randomness anywhere.
    again = initial_stages(_offer())
    assert [(m.title, m.amount, m.due_date) for m in again] == [
        (m.title, m.amount, m.due_date) for m in stages
    ]


def test_initial_stages_small_amount():
    stages = initial_stages(_offer(deliverables=[], price=Decimal("75")))
    assert len(stages) == 3
    assert sum(m.amount for m in stages) == Decimal("75")
    assert stages[0].amount == Decimal("18.75")
    assert stages[1].amount == Decimal("37.50")
    assert stages[2].amount == Decimal("18.75")
    assert stages[0].due_date == NOW.date() + timedelta(days=2)
