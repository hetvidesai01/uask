"""Seed realistic local-development data (Phase 7B).

Development tooling only — refuses to run when ENV is not development/test,
and seed data lives here rather than inside Alembic migrations.

Usage (from backend/):
    python scripts/seed.py           # seed an empty development database
    python scripts/seed.py --reset   # wipe development data, then seed fresh

Without --reset the script refuses to touch a database that already
contains data, so re-running it is always safe. Every seed account uses
the same password (SEED_PASSWORD) and fixed emails listed below.
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import AskStatus, OfferStatus, UserRole
from app.core.security import hash_password
from app.db.session import SessionLocal, engine
from app.models.ask import Ask
from app.models.offer import Offer
from app.models.user import User

SEED_PASSWORD = "password123"

_ALLOWED_ENVS = ("development", "test")

_ALL_TABLES = (
    "thread_participants",
    "messages",
    "threads",
    "offers",
    "asks",
    "notifications",
    "refresh_tokens",
    "users",
)


def _make_user(
    name: str,
    email: str,
    roles: list[UserRole],
    *,
    bio: str | None = None,
    location: str | None = None,
    categories: tuple[str, ...] = (),
    rating: str = "0.0",
    review_count: int = 0,
) -> User:
    return User(
        name=name,
        email=email,
        password_hash=hash_password(SEED_PASSWORD),
        roles=roles,
        bio=bio,
        location=location,
        categories=list(categories),
        rating=Decimal(rating),
        review_count=review_count,
    )


def _make_ask(
    requester: User,
    *,
    title: str,
    description: str,
    category: str,
    budget_min: str | None,
    budget_max: str | None,
    status: AskStatus,
    created_days_ago: int,
    deadline_days: int,
    location: str,
    is_remote: bool,
) -> Ask:
    created = datetime.now(UTC) - timedelta(days=created_days_ago)
    return Ask(
        requester=requester,
        title=title,
        description=description,
        category=category,
        budget_min=Decimal(budget_min) if budget_min else None,
        budget_max=Decimal(budget_max) if budget_max else None,
        currency="USD",
        deadline=datetime.now(UTC).date() + timedelta(days=deadline_days),
        location=location,
        is_remote=is_remote,
        status=status,
        created_at=created,
        updated_at=created,
    )


def _make_offer(
    ask: Ask,
    provider: User,
    *,
    price: str,
    delivery_days: int,
    pitch: str,
    deliverables: tuple[str, ...],
    status: OfferStatus,
    days_after_ask: int,
) -> Offer:
    created = ask.created_at + timedelta(days=days_after_ask)
    return Offer(
        ask=ask,
        provider=provider,
        price=Decimal(price),
        currency="USD",
        delivery_days=delivery_days,
        pitch=pitch,
        deliverables=list(deliverables),
        status=status,
        created_at=created,
        updated_at=created,
    )


def _has_data(session: Session) -> bool:
    for model in (User, Ask, Offer):
        count = session.scalar(select(func.count()).select_from(model))
        if count:
            return True
    return False


def _reset() -> None:
    truncate = "TRUNCATE " + ", ".join(_ALL_TABLES) + " RESTART IDENTITY CASCADE"
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text(truncate))


def _seed(session: Session) -> None:
    # --- users ---------------------------------------------------------
    alice = _make_user(
        "Alice Rivera",
        "alice@uask.dev",
        [UserRole.seeker],
        location="Austin, TX",
    )
    bob = _make_user(
        "Bob Patel",
        "bob@uask.dev",
        [UserRole.seeker],
        bio="Small-business owner in Austin, always hiring for odd jobs.",
        location="Round Rock, TX",
    )
    carol = _make_user(
        "Carol Nguyen",
        "carol@uask.dev",
        [UserRole.provider],
        bio="Brand and food photographer. Ten years, hundreds of shoots.",
        location="Austin, TX",
        categories=("Design", "Photography"),
        rating="4.8",
        review_count=23,
    )
    dave = _make_user(
        "Dave Kim",
        "dave@uask.dev",
        [UserRole.provider],
        bio="Copywriter and front-end developer. Fast, plain-spoken, reliable.",
        location="Dallas, TX",
        categories=("Writing", "Development"),
        rating="4.6",
        review_count=15,
    )
    erin = _make_user(
        "Erin Sato",
        "erin@uask.dev",
        [UserRole.provider],
        bio="Math tutor and event photographer. Weekend availability.",
        location="Austin, TX",
        categories=("Tutoring", "Photography"),
        rating="4.9",
        review_count=41,
    )
    frank = _make_user(
        "Frank Osei",
        "frank@uask.dev",
        [UserRole.seeker, UserRole.provider],
        bio="Handyman and studio owner — happy to hire and to help.",
        location="Austin, TX",
        categories=("Home services", "Errands"),
        rating="4.5",
        review_count=8,
    )
    users = [alice, bob, carol, dave, erin, frank]

    # --- asks ----------------------------------------------------------
    # 5 open, 2 closed with accepted offers, 1 cancelled — all 8 categories.
    ask_logo = _make_ask(
        alice,
        title="Design a logo and brand kit for a new bakery",
        description=(
            "Sunrise Bakery opens in December. I need a wordmark, a small "
            "icon, and a color palette that works on storefront signage, "
            "boxes, and a one-page menu."
        ),
        category="Design",
        budget_min="300",
        budget_max="700",
        status=AskStatus.open,
        created_days_ago=26,
        deadline_days=9,
        location="Austin, TX",
        is_remote=True,
    )
    ask_write = _make_ask(
        alice,
        title="Write five product pages for my online store",
        description=(
            "Our ceramics shop is launching a new collection. I need five "
            "product pages with headlines, body copy, and calls to action "
            "that match our friendly brand voice."
        ),
        category="Writing",
        budget_min="200",
        budget_max="500",
        status=AskStatus.open,
        created_days_ago=21,
        deadline_days=12,
        location="Austin, TX",
        is_remote=True,
    )
    ask_booking = _make_ask(
        frank,
        title="Build a simple booking page for my pottery studio",
        description=(
            "I run a small pottery studio and take bookings over email. I "
            "need a clean page with a calendar, class capacity, and a form "
            "that emails me on submission."
        ),
        category="Development",
        budget_min="700",
        budget_max="1500",
        status=AskStatus.open,
        created_days_ago=17,
        deadline_days=16,
        location="Austin, TX",
        is_remote=True,
    )
    ask_clean = _make_ask(
        bob,
        title="Deep clean a 2-bedroom apartment before move-out",
        description=(
            "Move-out is on the 30th. Two-bedroom apartment, mostly "
            "swept already — needs kitchen, bathrooms, baseboards, and "
            "inside the oven and fridge."
        ),
        category="Home services",
        budget_min="150",
        budget_max="400",
        status=AskStatus.open,
        created_days_ago=12,
        deadline_days=7,
        location="Round Rock, TX",
        is_remote=False,
    )
    ask_photo = _make_ask(
        alice,
        title="Photograph our bakery's holiday campaign",
        description=(
            "Six hero shots of pastries and two team portraits for our "
            "holiday campaign. On location at the bakery, natural light "
            "preferred, edited files delivered within a week."
        ),
        category="Photography",
        budget_min="400",
        budget_max="900",
        status=AskStatus.closed,
        created_days_ago=30,
        deadline_days=-16,
        location="Austin, TX",
        is_remote=False,
    )
    ask_tutor = _make_ask(
        bob,
        title="Weekly algebra tutoring for a high-school student",
        description=(
            "My daughter is in algebra II and struggling with word "
            "problems. Looking for one session a week for the rest of the "
            "semester, online or in person."
        ),
        category="Tutoring",
        budget_min="80",
        budget_max="200",
        status=AskStatus.closed,
        created_days_ago=24,
        deadline_days=-10,
        location="Round Rock, TX",
        is_remote=True,
    )
    ask_party = _make_ask(
        alice,
        title="Help plan a 50-person launch party",
        description=(
            "Planning a launch party for 50 guests in January. I need "
            "help with vendor coordination, a run-of-show timeline, and "
            "day-of support. Cancelled — postponing to spring."
        ),
        category="Events",
        budget_min=None,
        budget_max=None,
        status=AskStatus.cancelled,
        created_days_ago=19,
        deadline_days=-5,
        location="Austin, TX",
        is_remote=False,
    )
    ask_errand = _make_ask(
        bob,
        title="Assemble two bookshelves and haul away packaging",
        description=(
            "Two flat-pack bookshelves arrived today. I need someone "
            "with tools to assemble both and take the cardboard and "
            "packing material away."
        ),
        category="Errands",
        budget_min="80",
        budget_max="250",
        status=AskStatus.open,
        created_days_ago=7,
        deadline_days=21,
        location="Dallas, TX",
        is_remote=False,
    )
    asks = [
        ask_logo,
        ask_write,
        ask_booking,
        ask_clean,
        ask_photo,
        ask_tutor,
        ask_party,
        ask_errand,
    ]

    # --- offers --------------------------------------------------------
    # ask_logo has 4 live offers (compare endpoint supports up to 4).
    # Both closed asks have an accepted offer and rejected competitors.
    offers = [
        _make_offer(
            ask_logo,
            carol,
            price="450",
            delivery_days=7,
            pitch=(
                "I design bakery and cafe brands for a living — I can "
                "share three relevant case studies from last year."
            ),
            deliverables=("Wordmark + icon", "SVG/PNG files", "1 revision"),
            status=OfferStatus.pending,
            days_after_ask=2,
        ),
        _make_offer(
            ask_logo,
            dave,
            price="380",
            delivery_days=10,
            pitch=(
                "Happy to explore lettering that feels handmade and "
                "warm; includes two revision rounds and a mini guide."
            ),
            deliverables=("2 logo concepts", "Color palette"),
            status=OfferStatus.pending,
            days_after_ask=3,
        ),
        _make_offer(
            ask_logo,
            erin,
            price="520",
            delivery_days=5,
            pitch=(
                "Food-brand specialist with a fast process — moodboard, "
                "three concepts, then final files ready for print."
            ),
            deliverables=("3 concepts", "Print-ready files", "Brand sheet"),
            status=OfferStatus.shortlisted,
            days_after_ask=4,
        ),
        _make_offer(
            ask_logo,
            frank,
            price="410",
            delivery_days=6,
            pitch=(
                "I run a small studio and can turn this around this "
                "week with source files and a simple usage guide."
            ),
            deliverables=("Logo suite", "Source files"),
            status=OfferStatus.pending,
            days_after_ask=5,
        ),
        _make_offer(
            ask_write,
            carol,
            price="300",
            delivery_days=6,
            pitch=(
                "I write conversion-focused product pages and have "
                "worked with food and ceramics brands before."
            ),
            deliverables=("5 pages", "Headline options", "1 revision"),
            status=OfferStatus.shortlisted,
            days_after_ask=1,
        ),
        _make_offer(
            ask_write,
            dave,
            price="260",
            delivery_days=4,
            pitch=(
                "SaaS and ecommerce copywriter — I will draft all five "
                "pages with headlines, body copy, and CTAs included."
            ),
            deliverables=("5 product pages", "CTA variants"),
            status=OfferStatus.pending,
            days_after_ask=4,
        ),
        _make_offer(
            ask_booking,
            carol,
            price="950",
            delivery_days=14,
            pitch=(
                "Full-stack developer; I can ship a clean booking page "
                "with capacity limits and email alerts by Friday."
            ),
            deliverables=("Booking page", "Admin view", "Deploy"),
            status=OfferStatus.pending,
            days_after_ask=2,
        ),
        _make_offer(
            ask_booking,
            erin,
            price="875",
            delivery_days=10,
            pitch=(
                "I build small marketing sites fast — calendar embed, "
                "capacity-aware form, and mobile polish included."
            ),
            deliverables=("Responsive page", "Form + email"),
            status=OfferStatus.pending,
            days_after_ask=6,
        ),
        _make_offer(
            ask_photo,
            carol,
            price="600",
            delivery_days=7,
            pitch=(
                "I specialize in food and product photography and can "
                "shoot on location at your bakery next week."
            ),
            deliverables=("8 edited shots", "Retouching"),
            status=OfferStatus.accepted,
            days_after_ask=3,
        ),
        _make_offer(
            ask_photo,
            dave,
            price="540",
            delivery_days=10,
            pitch=(
                "Experienced with seasonal campaigns — I can deliver "
                "edited selects within four days of the shoot."
            ),
            deliverables=("8 edited shots"),
            status=OfferStatus.rejected,
            days_after_ask=6,
        ),
        _make_offer(
            ask_photo,
            erin,
            price="700",
            delivery_days=5,
            pitch=(
                "I photograph storefronts and teams regularly and "
                "carry my own lighting kit for consistent results."
            ),
            deliverables=("8 edited shots", "2 portraits", "Rush option"),
            status=OfferStatus.rejected,
            days_after_ask=9,
        ),
        _make_offer(
            ask_tutor,
            erin,
            price="120",
            delivery_days=1,
            pitch=(
                "Certified math tutor with four years of experience — "
                "the first session is a full diagnostic assessment."
            ),
            deliverables=("Weekly session", "Progress notes"),
            status=OfferStatus.accepted,
            days_after_ask=2,
        ),
        _make_offer(
            ask_tutor,
            carol,
            price="150",
            delivery_days=1,
            pitch=(
                "I tutor algebra and physics online and provide weekly "
                "progress notes so parents always know where things stand."
            ),
            deliverables=("Weekly session", "Practice sheets"),
            status=OfferStatus.rejected,
            days_after_ask=5,
        ),
        _make_offer(
            ask_party,
            dave,
            price="400",
            delivery_days=12,
            pitch=(
                "I have coordinated a handful of small launch events "
                "and can own the vendor timeline end to end."
            ),
            deliverables=("Run-of-show", "Vendor coordination"),
            status=OfferStatus.pending,
            days_after_ask=2,
        ),
        _make_offer(
            ask_errand,
            frank,
            price="130",
            delivery_days=3,
            pitch=(
                "I have a van and a full tool kit — I can assemble "
                "both shelves and take all the packaging away."
            ),
            deliverables=("2 shelves assembled", "Packaging removed"),
            status=OfferStatus.pending,
            days_after_ask=1,
        ),
    ]

    session.add_all(users)
    session.add_all(asks)
    session.add_all(offers)
    session.flush()
    session.commit()

    # --- summary -------------------------------------------------------
    status_order = (
        AskStatus.open,
        AskStatus.matched,
        AskStatus.in_review,
        AskStatus.closed,
        AskStatus.cancelled,
    )
    status_counts: dict[AskStatus, int] = {}
    for ask in asks:
        status_counts[ask.status] = status_counts.get(ask.status, 0) + 1
    breakdown = ", ".join(
        f"{status_counts[status]} {status.value}"
        for status in status_order
        if status_counts.get(status)
    )

    print("Seeded development data:")
    print(f"  users: {len(users)}   asks: {len(asks)}   offers: {len(offers)}")
    print(f"  ASK states: {breakdown}")
    print(f"Accounts (password for all: {SEED_PASSWORD}):")
    for user in users:
        roles = ",".join(role.value for role in user.roles)
        print(f"  {user.email:<20} {roles:<22} {user.name}")
    print("Start the API: uvicorn app.main:app --reload")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Seed UASK development data (never runs in production).",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="truncate all tables first, then seed fresh data",
    )
    args = parser.parse_args()

    settings = get_settings()
    if settings.ENV.lower() not in _ALLOWED_ENVS:
        print(
            f"Refusing to seed: ENV={settings.ENV!r}. "
            "Seed data is for development and test only.",
            file=sys.stderr,
        )
        return 1

    session = SessionLocal()
    try:
        already_has_data = _has_data(session)
        # End the read transaction so a following TRUNCATE cannot block.
        session.rollback()
        if already_has_data and not args.reset:
            print(
                "Development data already exists. "
                "Re-run with --reset to wipe it and seed fresh data.",
                file=sys.stderr,
            )
            return 1
        if args.reset:
            print("Reset: truncating all tables ...")
            _reset()
        _seed(session)
    except OperationalError as exc:
        print(
            "Database error — is PostgreSQL running and migrated? "
            "Run: alembic upgrade head",
            file=sys.stderr,
        )
        print(exc, file=sys.stderr)
        return 1
    finally:
        session.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
