"""Backend Contract Alignment Phase 4 — contracts, milestones, rating, reputation."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

API = "/api/v1"

CONTRACT_KEYS = {
    "id",
    "askId",
    "offerId",
    "seekerId",
    "providerId",
    "agreedPrice",
    "currency",
    "deliverables",
    "status",
    "rating",
    "review",
    "createdAt",
    "completedAt",
    "milestones",
}
MILESTONE_KEYS = {
    "id",
    "contractId",
    "title",
    "description",
    "amount",
    "dueDate",
    "status",
}
COMPLETED_KEYS = {
    "id",
    "askId",
    "askTitle",
    "agreedPrice",
    "currency",
    "status",
    "completedAt",
    "rating",
    "review",
}
REPUTATION_KEYS = {
    "revenue",
    "averageRating",
    "reviewCount",
    "completedContractCount",
    "completedMilestoneCount",
    "totalMilestoneCount",
    "profileBoosterPct",
}
ENVELOPE_KEYS = {"items", "page", "pageSize", "total", "totalPages", "hasNext"}


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def _signup(
    client: TestClient, roles: list[str], *, name: str = "Contract Tester"
) -> tuple[dict, str]:
    email = f"{uuid.uuid4().hex[:12]}@example.com"
    resp = client.post(
        f"{API}/auth/signup",
        json={
            "name": name,
            "email": email,
            "password": "password123",
            "roles": roles,
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return {"Authorization": f"Bearer {body['accessToken']}"}, body["user"]["id"]


def _create_ask(client: TestClient, headers: dict, **overrides) -> dict:
    payload = {
        "title": "Need a professional logo design",
        "description": (
            "Looking for a modern logo for my new bakery brand that works "
            "on storefront signage and business cards."
        ),
        "category": "Design",
        "budgetMin": 100,
        "budgetMax": 500,
        "currency": "INR",
        "deadline": (datetime.now(UTC).date() + timedelta(days=14)).isoformat(),
        "location": "Austin, TX",
        "isRemote": True,
    }
    payload.update(overrides)
    resp = client.post(f"{API}/asks", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_offer(
    client: TestClient, headers: dict, ask_id: str, **overrides
) -> dict:
    payload = {
        "price": 450,
        "deliveryDays": 6,
        "pitch": (
            "I can deliver this project quickly with two rounds of "
            "revisions included in the price."
        ),
        "deliverables": ["Draft", "Final files", "Handoff"],
        "attachments": [],
    }
    payload.update(overrides)
    resp = client.post(
        f"{API}/asks/{ask_id}/offers", json=payload, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _accept(client: TestClient, headers: dict, offer_id: str) -> dict:
    resp = client.patch(
        f"{API}/offers/{offer_id}",
        json={"status": "accepted"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


@dataclass
class Ctx:
    seeker_headers: dict
    seeker_id: str
    provider_headers: dict
    provider_id: str
    ask: dict
    offer: dict
    contract: dict


def _setup_contract(client: TestClient, **offer_overrides) -> Ctx:
    seeker_headers, seeker_id = _signup(client, ["seeker"], name="Seeker Owner")
    provider_headers, provider_id = _signup(
        client, ["provider"], name="Working Provider"
    )
    ask = _create_ask(client, seeker_headers)
    offer = _create_offer(client, provider_headers, ask["id"], **offer_overrides)
    _accept(client, seeker_headers, offer["id"])
    resp = client.get(
        f"{API}/asks/{ask['id']}/contract", headers=seeker_headers
    )
    assert resp.status_code == 200, resp.text
    return Ctx(
        seeker_headers=seeker_headers,
        seeker_id=seeker_id,
        provider_headers=provider_headers,
        provider_id=provider_id,
        ask=ask,
        offer=offer,
        contract=resp.json(),
    )


def _patch_milestone(
    client: TestClient, headers: dict, contract_id: str, milestone_id: str, status: str
):
    return client.patch(
        f"{API}/contracts/{contract_id}/milestones/{milestone_id}",
        json={"status": status},
        headers=headers,
    )


def _complete(client: TestClient, headers: dict, contract_id: str):
    return client.post(f"{API}/contracts/{contract_id}/complete", headers=headers)


def _rate(
    client: TestClient,
    headers: dict,
    contract_id: str,
    payload: dict,
):
    return client.post(
        f"{API}/contracts/{contract_id}/rating", json=payload, headers=headers
    )


def _milestone(client: TestClient, ctx: Ctx, index: int = 0) -> dict:
    return ctx.contract["milestones"][index]


# --------------------------------------------------------------------------
# Contract creation from the accepted offer
# --------------------------------------------------------------------------


def test_contract_created_from_accepted_offer(client: TestClient):
    ctx = _setup_contract(client)
    contract = ctx.contract

    assert set(contract.keys()) == CONTRACT_KEYS
    assert contract["askId"] == ctx.ask["id"]
    assert contract["offerId"] == ctx.offer["id"]
    assert contract["seekerId"] == ctx.seeker_id
    assert contract["providerId"] == ctx.provider_id
    assert contract["agreedPrice"] == 450
    assert contract["currency"] == "INR"
    assert contract["deliverables"] == ctx.offer["deliverables"]
    assert contract["status"] == "active"
    assert contract["rating"] is None
    assert contract["review"] is None
    assert contract["completedAt"] is None
    assert isinstance(contract["createdAt"], str)
    assert len(contract["milestones"]) >= 1
    for milestone in contract["milestones"]:
        assert set(milestone.keys()) == MILESTONE_KEYS
        assert milestone["contractId"] == contract["id"]
        assert milestone["status"] == "upcoming"


def test_contract_preserves_offer_currency(client: TestClient):
    seeker_headers, _ = _signup(client, ["seeker"], name="USD Seeker")
    provider_headers, _ = _signup(client, ["provider"], name="USD Provider")
    ask = _create_ask(client, seeker_headers, currency="USD")
    offer = _create_offer(client, provider_headers, ask["id"], currency="USD")
    _accept(client, seeker_headers, offer["id"])

    resp = client.get(f"{API}/asks/{ask['id']}/contract", headers=seeker_headers)
    contract = resp.json()
    assert contract["currency"] == "USD"
    assert contract["agreedPrice"] == offer["price"]


def test_initial_milestones_split_amount_and_dates(client: TestClient):
    ctx = _setup_contract(
        client,
        price=100,
        deliveryDays=6,
        deliverables=["Draft", "Final files", "Handoff"],
    )
    milestones = ctx.contract["milestones"]

    assert len(milestones) == 3
    assert [m["title"] for m in milestones] == [
        "Draft",
        "Final files",
        "Handoff",
    ]
    # Even split; remainder credited to the final milestone.
    assert [m["amount"] for m in milestones] == [33.33, 33.33, 33.34]
    assert round(sum(m["amount"] for m in milestones), 2) == 100
    # Due dates spread across deliveryDays from the offer creation date.
    today = datetime.now(UTC).date().isoformat()
    assert today < milestones[0]["dueDate"] <= milestones[2]["dueDate"]
    assert all(m["dueDate"] is not None for m in milestones)
    assert [m["status"] for m in milestones] == ["upcoming"] * 3


def test_initial_milestones_capped_at_three(client: TestClient):
    ctx = _setup_contract(
        client,
        price=400,
        deliverables=["One", "Two", "Three", "Four", "Five"],
    )
    milestones = ctx.contract["milestones"]
    assert len(milestones) == 3
    assert [m["title"] for m in milestones] == ["One", "Two", "Three"]
    assert round(sum(m["amount"] for m in milestones), 2) == 400


def test_initial_milestones_without_deliverables(client: TestClient):
    ctx = _setup_contract(client, price=250, deliverables=[])
    milestones = ctx.contract["milestones"]
    assert len(milestones) == 1
    assert milestones[0]["amount"] == 250
    assert milestones[0]["title"] == "Project delivery"


def test_one_contract_per_ask_even_after_failed_reaccept(
    client: TestClient, db
):
    ctx = _setup_contract(client)
    # Re-accepting the same offer must not mint a second contract.
    resp = client.patch(
        f"{API}/offers/{ctx.offer['id']}",
        json={"status": "accepted"},
        headers=ctx.seeker_headers,
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "OFFER_ALREADY_ACCEPTED"

    again = client.get(
        f"{API}/asks/{ctx.ask['id']}/contract", headers=ctx.seeker_headers
    )
    assert again.status_code == 200
    assert again.json()["id"] == ctx.contract["id"]

    from sqlalchemy import func, select

    from app.models.contract import Contract

    count = db.scalar(
        select(func.count()).select_from(Contract).where(
            Contract.ask_id == uuid.UUID(ctx.ask["id"])
        )
    )
    assert count == 1


def test_contract_not_found_before_accept(client: TestClient):
    seeker_headers, _ = _signup(client, ["seeker"], name="Open Seeker")
    provider_headers, _ = _signup(client, ["provider"], name="Open Provider")
    ask = _create_ask(client, seeker_headers)
    _create_offer(client, provider_headers, ask["id"])

    resp = client.get(
        f"{API}/asks/{ask['id']}/contract", headers=seeker_headers
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "CONTRACT_NOT_FOUND"


def test_contracts_list_is_scoped_and_enveloped(client: TestClient):
    ctx = _setup_contract(client)
    other_headers, _ = _signup(client, ["seeker"], name="Other Seeker")

    resp = client.get(f"{API}/contracts", headers=ctx.seeker_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == ENVELOPE_KEYS
    assert body["total"] == 1
    assert set(body["items"][0].keys()) == CONTRACT_KEYS
    assert body["items"][0]["id"] == ctx.contract["id"]

    # The provider sees the same contract; unrelated users see none.
    provider_list = client.get(f"{API}/contracts", headers=ctx.provider_headers)
    assert provider_list.json()["total"] == 1
    stranger_list = client.get(f"{API}/contracts", headers=other_headers)
    assert stranger_list.json()["total"] == 0
    assert stranger_list.json()["items"] == []


def test_contracts_require_auth(client: TestClient):
    resp = client.get(f"{API}/contracts")
    assert resp.status_code == 401
    assert _error_code(resp) == "UNAUTHORIZED"


def test_contract_access_is_participant_only(client: TestClient):
    ctx = _setup_contract(client)
    stranger_headers, _ = _signup(client, ["seeker"], name="Nosy Stranger")
    milestone_id = ctx.contract["milestones"][0]["id"]

    resp = client.get(
        f"{API}/asks/{ctx.ask['id']}/contract", headers=stranger_headers
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_CONTRACT_PARTICIPANT"

    resp = _patch_milestone(
        client,
        stranger_headers,
        ctx.contract["id"],
        milestone_id,
        "in_progress",
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_CONTRACT_PARTICIPANT"

    resp = _complete(client, stranger_headers, ctx.contract["id"])
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_CONTRACT_PARTICIPANT"

    resp = _rate(
        client, stranger_headers, ctx.contract["id"], {"rating": 5}
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_CONTRACT_PARTICIPANT"

    resp = client.get(f"{API}/contracts")
    assert resp.status_code == 401


# --------------------------------------------------------------------------
# Milestone workflow — role-gated, paid is terminal
# --------------------------------------------------------------------------


def test_provider_submits_seeker_approves_and_pays(client: TestClient):
    ctx = _setup_contract(client)
    contract_id = ctx.contract["id"]
    milestone_id = ctx.contract["milestones"][0]["id"]

    resp = _patch_milestone(
        client,
        ctx.provider_headers,
        contract_id,
        milestone_id,
        "in_progress",
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "in_progress"
    assert set(resp.json().keys()) == MILESTONE_KEYS

    resp = _patch_milestone(
        client, ctx.provider_headers, contract_id, milestone_id, "submitted"
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "submitted"

    resp = _patch_milestone(
        client, ctx.seeker_headers, contract_id, milestone_id, "approved"
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"

    resp = _patch_milestone(
        client, ctx.seeker_headers, contract_id, milestone_id, "paid"
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"


def test_provider_can_submit_straight_from_upcoming(client: TestClient):
    ctx = _setup_contract(client)
    milestone_id = ctx.contract["milestones"][0]["id"]
    resp = _patch_milestone(
        client,
        ctx.provider_headers,
        ctx.contract["id"],
        milestone_id,
        "submitted",
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "submitted"


def test_seeker_cannot_submit_on_behalf_of_provider(client: TestClient):
    ctx = _setup_contract(client)
    milestone_id = ctx.contract["milestones"][0]["id"]

    resp = _patch_milestone(
        client,
        ctx.seeker_headers,
        ctx.contract["id"],
        milestone_id,
        "in_progress",
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "PROVIDER_ONLY"

    resp = _patch_milestone(
        client,
        ctx.seeker_headers,
        ctx.contract["id"],
        milestone_id,
        "submitted",
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "PROVIDER_ONLY"


def test_provider_cannot_approve_or_pay(client: TestClient):
    ctx = _setup_contract(client)
    contract_id = ctx.contract["id"]
    milestone_id = ctx.contract["milestones"][0]["id"]

    _patch_milestone(
        client, ctx.provider_headers, contract_id, milestone_id, "submitted"
    )
    resp = _patch_milestone(
        client, ctx.provider_headers, contract_id, milestone_id, "approved"
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "SEEKER_ONLY"

    _patch_milestone(
        client, ctx.seeker_headers, contract_id, milestone_id, "approved"
    )
    resp = _patch_milestone(
        client, ctx.provider_headers, contract_id, milestone_id, "paid"
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "SEEKER_ONLY"


def test_invalid_transitions_are_rejected(client: TestClient):
    ctx = _setup_contract(client)
    contract_id = ctx.contract["id"]
    milestone_id = ctx.contract["milestones"][0]["id"]

    # seeker jumping ahead from upcoming
    resp = _patch_milestone(
        client, ctx.seeker_headers, contract_id, milestone_id, "approved"
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "INVALID_STATUS_TRANSITION"

    # skipping approval: submitted -> paid
    _patch_milestone(
        client, ctx.provider_headers, contract_id, milestone_id, "submitted"
    )
    resp = _patch_milestone(
        client, ctx.seeker_headers, contract_id, milestone_id, "paid"
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "INVALID_STATUS_TRANSITION"

    # a no-op status write is not a transition
    resp = _patch_milestone(
        client, ctx.provider_headers, contract_id, milestone_id, "submitted"
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "INVALID_STATUS_TRANSITION"


def test_paid_milestone_is_terminal(client: TestClient):
    ctx = _setup_contract(client)
    contract_id = ctx.contract["id"]
    milestone_id = ctx.contract["milestones"][0]["id"]

    _patch_milestone(
        client, ctx.provider_headers, contract_id, milestone_id, "submitted"
    )
    _patch_milestone(
        client, ctx.seeker_headers, contract_id, milestone_id, "approved"
    )
    _patch_milestone(
        client, ctx.seeker_headers, contract_id, milestone_id, "paid"
    )

    for role_headers, target in (
        (ctx.provider_headers, "in_progress"),
        (ctx.provider_headers, "submitted"),
        (ctx.seeker_headers, "approved"),
        (ctx.seeker_headers, "paid"),
    ):
        resp = _patch_milestone(
            client, role_headers, contract_id, milestone_id, target
        )
        assert resp.status_code == 409, target
        assert _error_code(resp) == "INVALID_STATUS_TRANSITION"


def test_milestone_unknown_ids(client: TestClient):
    ctx = _setup_contract(client)

    resp = _patch_milestone(
        client,
        ctx.provider_headers,
        str(uuid.uuid4()),
        ctx.contract["milestones"][0]["id"],
        "in_progress",
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "CONTRACT_NOT_FOUND"

    resp = _patch_milestone(
        client,
        ctx.provider_headers,
        ctx.contract["id"],
        str(uuid.uuid4()),
        "in_progress",
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "MILESTONE_NOT_FOUND"


def test_completed_contract_freezes_milestones(client: TestClient):
    ctx = _setup_contract(client)
    assert _complete(client, ctx.seeker_headers, ctx.contract["id"]).status_code == 200

    resp = _patch_milestone(
        client,
        ctx.provider_headers,
        ctx.contract["id"],
        ctx.contract["milestones"][0]["id"],
        "in_progress",
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "CONTRACT_NOT_ACTIVE"


# --------------------------------------------------------------------------
# Completion
# --------------------------------------------------------------------------


def test_only_seeker_can_complete_contract(client: TestClient):
    ctx = _setup_contract(client)
    contract_id = ctx.contract["id"]

    resp = _complete(client, ctx.provider_headers, contract_id)
    assert resp.status_code == 403
    assert _error_code(resp) == "SEEKER_ONLY"

    before = datetime.now(UTC)
    resp = _complete(client, ctx.seeker_headers, contract_id)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "completed"
    assert body["completedAt"] is not None
    completed_at = datetime.fromisoformat(body["completedAt"])
    assert completed_at >= before
    assert body["rating"] is None

    # Re-completing is an invalid transition.
    resp = _complete(client, ctx.seeker_headers, contract_id)
    assert resp.status_code == 409
    assert _error_code(resp) == "CONTRACT_NOT_ACTIVE"

    # Completion changes nothing else: ASK and offer keep their state.
    ask = client.get(f"{API}/asks/{ctx.ask['id']}", headers=ctx.seeker_headers)
    assert ask.json()["status"] == "accepted"
    offer = client.get(f"{API}/offers/{ctx.offer['id']}", headers=ctx.seeker_headers)
    assert offer.json()["status"] == "accepted"


# --------------------------------------------------------------------------
# Rating
# --------------------------------------------------------------------------


def test_only_completed_contract_can_be_rated(client: TestClient):
    ctx = _setup_contract(client)

    resp = _rate(client, ctx.seeker_headers, ctx.contract["id"], {"rating": 5})
    assert resp.status_code == 409
    assert _error_code(resp) == "CONTRACT_NOT_COMPLETED"


def test_only_seeker_can_rate(client: TestClient):
    ctx = _setup_contract(client)
    _complete(client, ctx.seeker_headers, ctx.contract["id"])

    resp = _rate(client, ctx.provider_headers, ctx.contract["id"], {"rating": 5})
    assert resp.status_code == 403
    assert _error_code(resp) == "SEEKER_ONLY"


def test_rating_range_and_review_length_validation(client: TestClient):
    ctx = _setup_contract(client)
    _complete(client, ctx.seeker_headers, ctx.contract["id"])

    for payload in (
        {"rating": 6},
        {"rating": -1},
        {"rating": 5, "review": "x" * 1001},
        {},
    ):
        resp = _rate(client, ctx.seeker_headers, ctx.contract["id"], payload)
        assert resp.status_code == 422, payload


def test_rating_success_is_set_once_and_derives_profile(
    client: TestClient
):
    ctx = _setup_contract(client)
    contract_id = ctx.contract["id"]
    _complete(client, ctx.seeker_headers, contract_id)

    resp = _rate(
        client,
        ctx.seeker_headers,
        contract_id,
        {"rating": 4.5, "review": "Fast and thoughtful work."},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["rating"] == 4.5
    assert body["review"] == "Fast and thoughtful work."
    assert body["status"] == "completed"

    # Derived profile fields follow the rated, completed contract.
    profile = client.get(
        f"{API}/users/{ctx.provider_id}", headers=ctx.seeker_headers
    )
    assert profile.json()["rating"] == 4.5
    assert profile.json()["reviewCount"] == 1

    # One rating per contract — set once.
    resp = _rate(client, ctx.seeker_headers, contract_id, {"rating": 1})
    assert resp.status_code == 409
    assert _error_code(resp) == "ALREADY_RATED"

    after = client.get(f"{API}/contracts", headers=ctx.seeker_headers)
    assert after.json()["items"][0]["rating"] == 4.5


def test_rating_without_review_is_allowed(client: TestClient):
    ctx = _setup_contract(client)
    _complete(client, ctx.seeker_headers, ctx.contract["id"])
    resp = _rate(client, ctx.seeker_headers, ctx.contract["id"], {"rating": 5})
    assert resp.status_code == 200
    assert resp.json()["review"] is None


def test_profile_rating_cannot_be_patched_by_user(client: TestClient):
    provider_headers, provider_id = _signup(
        client, ["provider"], name="Self Rater"
    )
    resp = client.patch(
        f"{API}/users/{provider_id}",
        json={"rating": 5, "reviewCount": 99},
        headers=provider_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["rating"] == 0.0
    assert resp.json()["reviewCount"] == 0

    profile = client.get(f"{API}/users/{provider_id}", headers=provider_headers)
    assert profile.json()["rating"] == 0.0
    assert profile.json()["reviewCount"] == 0


def test_derived_average_rating_across_contracts(client: TestClient):
    seeker_headers, _ = _signup(client, ["seeker"], name="Repeat Seeker")
    provider_headers, provider_id = _signup(
        client, ["provider"], name="Repeat Provider"
    )

    for price, rating in ((300, 5.0), (200, 4.0)):
        ask = _create_ask(client, seeker_headers, title=f"Ask at {price}")
        offer = _create_offer(
            client, provider_headers, ask["id"], price=price
        )
        _accept(client, seeker_headers, offer["id"])
        contract = client.get(
            f"{API}/asks/{ask['id']}/contract", headers=seeker_headers
        ).json()
        _complete(client, seeker_headers, contract["id"])
        _rate(client, seeker_headers, contract["id"], {"rating": rating})

    profile = client.get(f"{API}/users/{provider_id}", headers=seeker_headers)
    assert profile.json()["rating"] == 4.5
    assert profile.json()["reviewCount"] == 2


# --------------------------------------------------------------------------
# Reputation
# --------------------------------------------------------------------------


def test_reputation_shape_and_zero_state(client: TestClient):
    provider_headers, provider_id = _signup(
        client, ["provider"], name="Fresh Provider"
    )
    resp = client.get(f"{API}/users/{provider_id}/reputation", headers=provider_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == REPUTATION_KEYS
    assert body == {
        "revenue": 0.0,
        "averageRating": 0.0,
        "reviewCount": 0,
        "completedContractCount": 0,
        "completedMilestoneCount": 0,
        "totalMilestoneCount": 0,
        "profileBoosterPct": 0,
    }

    resp = client.get(f"{API}/users/{provider_id}/reputation")
    assert resp.status_code == 401


def test_reputation_unknown_user(client: TestClient):
    provider_headers, _ = _signup(client, ["provider"])
    resp = client.get(
        f"{API}/users/{uuid.uuid4()}/reputation", headers=provider_headers
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "USER_NOT_FOUND"


def _pay_milestone(client: TestClient, ctx: Ctx, index: int = 0) -> float:
    milestone = ctx.contract["milestones"][index]
    milestone_id = milestone["id"]
    contract_id = ctx.contract["id"]
    _patch_milestone(
        client, ctx.provider_headers, contract_id, milestone_id, "submitted"
    )
    _patch_milestone(
        client, ctx.seeker_headers, contract_id, milestone_id, "approved"
    )
    resp = _patch_milestone(
        client, ctx.seeker_headers, contract_id, milestone_id, "paid"
    )
    assert resp.status_code == 200, resp.text
    return float(milestone["amount"])


def test_reputation_revenue_and_booster_after_full_payment(
    client: TestClient,
):
    ctx = _setup_contract(client)  # 450 split into 3 × 150
    for index in range(3):
        _pay_milestone(client, ctx, index)
    _complete(client, ctx.seeker_headers, ctx.contract["id"])
    _rate(client, ctx.seeker_headers, ctx.contract["id"], {"rating": 5})

    resp = client.get(
        f"{API}/users/{ctx.provider_id}/reputation",
        headers=ctx.provider_headers,
    )
    body = resp.json()
    assert body["revenue"] == 450.0
    assert body["completedMilestoneCount"] == 3
    assert body["totalMilestoneCount"] == 3
    # round(3/3 * 20) — every milestone paid.
    assert body["profileBoosterPct"] == 20
    assert body["completedContractCount"] == 1
    assert body["averageRating"] == 5.0
    assert body["reviewCount"] == 1


def test_reputation_partial_payment_booster(client: TestClient):
    ctx = _setup_contract(client)  # 450 split into 3 × 150
    paid_amount = _pay_milestone(client, ctx, 0)

    body = client.get(
        f"{API}/users/{ctx.provider_id}/reputation",
        headers=ctx.provider_headers,
    ).json()
    assert body["revenue"] == paid_amount == 150.0
    assert body["completedMilestoneCount"] == 1
    assert body["totalMilestoneCount"] == 3
    # round(1/3 * 20) = round(6.67) = 7
    assert body["profileBoosterPct"] == 7
    # Not completed, not rated yet.
    assert body["completedContractCount"] == 0
    assert body["averageRating"] == 0.0
    assert body["reviewCount"] == 0


def test_reputation_excludes_other_providers(client: TestClient):
    ctx = _setup_contract(client)
    _pay_milestone(client, ctx, 0)
    bystander_headers, bystander_id = _signup(
        client, ["provider"], name="Bystander Provider"
    )

    body = client.get(
        f"{API}/users/{bystander_id}/reputation", headers=bystander_headers
    ).json()
    assert body["revenue"] == 0.0
    assert body["totalMilestoneCount"] == 0
    assert body["profileBoosterPct"] == 0


# --------------------------------------------------------------------------
# Completed contract history
# --------------------------------------------------------------------------


def test_completed_contracts_history(client: TestClient):
    ctx = _setup_contract(client)
    first_contract = ctx.contract

    # second contract, completed later so it sorts first
    ask2 = _create_ask(client, ctx.seeker_headers, title="Second accepted ask")
    offer2 = _create_offer(client, ctx.provider_headers, ask2["id"], price=200)
    _accept(client, ctx.seeker_headers, offer2["id"])
    contract2 = client.get(
        f"{API}/asks/{ask2['id']}/contract", headers=ctx.seeker_headers
    ).json()

    # an active contract must not appear yet
    ask3 = _create_ask(client, ctx.seeker_headers, title="Still active ask")
    offer3 = _create_offer(client, ctx.provider_headers, ask3["id"], price=100)
    _accept(client, ctx.seeker_headers, offer3["id"])

    _complete(client, ctx.seeker_headers, first_contract["id"])
    _rate(
        client,
        ctx.seeker_headers,
        first_contract["id"],
        {"rating": 4, "review": "Solid delivery."},
    )
    _complete(client, ctx.seeker_headers, contract2["id"])

    resp = client.get(
        f"{API}/users/{ctx.provider_id}/completed-contracts",
        headers=ctx.seeker_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == ENVELOPE_KEYS
    assert body["total"] == 2
    items = body["items"]
    assert all(set(item.keys()) == COMPLETED_KEYS for item in items)
    # newest completedAt first
    assert items[0]["askId"] == ask2["id"]
    assert items[1]["askId"] == first_contract["askId"]
    assert items[1]["rating"] == 4
    assert items[1]["review"] == "Solid delivery."
    assert items[0]["rating"] is None
    assert all(item["status"] == "completed" for item in items)
    assert all(item["completedAt"] is not None for item in items)

    # also visible from the seeker side of the same contracts
    seeker_view = client.get(
        f"{API}/users/{ctx.seeker_id}/completed-contracts",
        headers=ctx.seeker_headers,
    )
    assert seeker_view.json()["total"] == 2


def test_completed_contracts_unknown_user(client: TestClient):
    provider_headers, _ = _signup(client, ["provider"])
    resp = client.get(
        f"{API}/users/{uuid.uuid4()}/completed-contracts",
        headers=provider_headers,
    )
    assert resp.status_code == 404
    assert _error_code(resp) == "USER_NOT_FOUND"
