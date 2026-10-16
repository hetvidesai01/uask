"""Backend Contract Alignment Phase 8 — the redesigned contract workflow.

Covers: draft/signing, 25/50/25 stage gating, progress submission/approval,
revisions, amendments + edit fees, disputes, cancellation, history, and the
camelCase serialization of the new contract response.
"""

import uuid

from fastapi.testclient import TestClient

API = "/api/v1"

ENVELOPE_KEYS = {
    "items",
    "page",
    "pageSize",
    "total",
    "totalPages",
    "hasNext",
}


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def _signup(client: TestClient, roles: list[str], name: str) -> tuple[dict, str]:
    email = f"{uuid.uuid4().hex[:12]}@example.com"
    resp = client.post(
        f"{API}/auth/signup",
        json={
            "name": name,
            "email": email,
            "password": "password123",
            "termsAccepted": True,
            "privacyAccepted": True,
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
        "isRemote": True,
    }
    payload.update(overrides)
    resp = client.post(f"{API}/asks", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_offer(client: TestClient, headers: dict, ask_id: str, **overrides) -> dict:
    payload = {
        "price": 400,
        "deliveryDays": 6,
        "pitch": (
            "I can deliver this project quickly with two rounds of "
            "revisions included in the price."
        ),
        "deliverables": ["Draft", "Final files"],
        "attachments": [],
    }
    payload.update(overrides)
    resp = client.post(f"{API}/asks/{ask_id}/offers", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _accept(client: TestClient, headers: dict, offer_id: str) -> dict:
    resp = client.patch(
        f"{API}/offers/{offer_id}", json={"status": "accepted"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _sign(client: TestClient, headers: dict, contract_id: str) -> dict:
    return client.post(f"{API}/contracts/{contract_id}/sign", headers=headers)


def _contract(client: TestClient, headers: dict, contract_id: str) -> dict:
    resp = client.get(f"{API}/contracts/{contract_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _stage(ctx: dict, kind: str) -> dict:
    for milestone in ctx["milestones"]:
        if milestone["kind"] == kind:
            return milestone
    raise AssertionError(f"no {kind} stage")


def _patch_stage(client, headers, contract_id, milestone_id, status):
    return client.patch(
        f"{API}/contracts/{contract_id}/milestones/{milestone_id}",
        json={"status": status},
        headers=headers,
    )


def _full_active(client: TestClient) -> dict:
    """Two users, accepted offer, both signed -> active contract (400 total)."""
    seeker_headers, seeker_id = _signup(client, ["seeker"], "Seeker")
    provider_headers, provider_id = _signup(client, ["provider"], "Provider")
    ask = _create_ask(client, seeker_headers)
    offer = _create_offer(client, provider_headers, ask["id"], price=400)
    _accept(client, seeker_headers, offer["id"])
    resp = client.get(f"{API}/asks/{ask['id']}/contract", headers=seeker_headers)
    contract_id = resp.json()["id"]
    _sign(client, seeker_headers, contract_id)
    _sign(client, provider_headers, contract_id)
    return {
        "seeker_headers": seeker_headers,
        "seeker_id": seeker_id,
        "provider_headers": provider_headers,
        "provider_id": provider_id,
        "ask": ask,
        "offer": offer,
        "contract_id": contract_id,
    }


# --------------------------------------------------------------------------
# Draft / signing
# --------------------------------------------------------------------------


def test_accepted_offer_creates_draft(client: TestClient):
    seeker_headers, _ = _signup(client, ["seeker"], "Seeker")
    provider_headers, _ = _signup(client, ["provider"], "Provider")
    ask = _create_ask(client, seeker_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    _accept(client, seeker_headers, offer["id"])
    resp = client.get(f"{API}/asks/{ask['id']}/contract", headers=seeker_headers)
    assert resp.json()["status"] == "draft"


def test_one_signature_does_not_activate(client: TestClient):
    seeker_headers, _ = _signup(client, ["seeker"], "Seeker")
    provider_headers, _ = _signup(client, ["provider"], "Provider")
    ask = _create_ask(client, seeker_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    _accept(client, seeker_headers, offer["id"])
    contract_id = client.get(
        f"{API}/asks/{ask['id']}/contract", headers=seeker_headers
    ).json()["id"]

    resp = _sign(client, seeker_headers, contract_id)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "awaiting_signatures"
    assert body["askSideSignedAt"] is not None
    assert body["respondSideSignedAt"] is None
    # Initial stage is NOT due yet.
    assert _stage(body, "initial")["status"] == "not_due"


def test_both_signatures_activate_and_due_initial(client: TestClient):
    ctx = _full_active(client)
    body = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    assert body["status"] == "active"
    assert body["askSideSignedAt"] is not None
    assert body["respondSideSignedAt"] is not None
    assert body["projectProgress"] == 0
    # Initial stage becomes due on activation.
    assert _stage(body, "initial")["status"] == "due"
    assert _stage(body, "progress")["status"] == "not_due"
    assert _stage(body, "final")["status"] == "not_due"


def test_signing_is_idempotent(client: TestClient):
    ctx = _full_active(client)
    # Signing again returns the same state, no error.
    resp = _sign(client, ctx["seeker_headers"], ctx["contract_id"])
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"
    resp = _sign(client, ctx["provider_headers"], ctx["contract_id"])
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"


def test_signer_is_never_taken_from_the_request_body(client: TestClient):
    """The signer is derived from the auth user — a spoofed body is ignored."""
    seeker_headers, _ = _signup(client, ["seeker"], "Seeker")
    provider_headers, provider_id = _signup(client, ["provider"], "Provider")
    ask = _create_ask(client, seeker_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    _accept(client, seeker_headers, offer["id"])
    contract_id = client.get(
        f"{API}/asks/{ask['id']}/contract", headers=seeker_headers
    ).json()["id"]

    # Seeker signs but tries to spoof the provider's side in the body.
    resp = client.post(
        f"{API}/contracts/{contract_id}/sign",
        json={"userId": provider_id, "respondSideSignedAt": "2026-01-01T00:00:00Z"},
        headers=seeker_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Only the seeker's side is signed; the spoof changed nothing.
    assert body["askSideSignedAt"] is not None
    assert body["respondSideSignedAt"] is None
    assert body["status"] == "awaiting_signatures"


def test_unrelated_user_cannot_sign(client: TestClient):
    seeker_headers, _ = _signup(client, ["seeker"], "Seeker")
    provider_headers, _ = _signup(client, ["provider"], "Provider")
    stranger_headers, _ = _signup(client, ["seeker"], "Stranger")
    ask = _create_ask(client, seeker_headers)
    offer = _create_offer(client, provider_headers, ask["id"])
    _accept(client, seeker_headers, offer["id"])
    contract_id = client.get(
        f"{API}/asks/{ask['id']}/contract", headers=seeker_headers
    ).json()["id"]

    resp = _sign(client, stranger_headers, contract_id)
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_CONTRACT_PARTICIPANT"


def test_completed_contract_cannot_be_signed(client: TestClient):
    ctx = _full_active(client)
    # Drive the whole schedule: initial paid -> 60% approved + paid ->
    # final approved + paid -> completed.
    _pay(client, ctx, "initial")
    _submit(client, ctx, 60)
    client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress/approve",
        headers=ctx["seeker_headers"],
    )
    _pay(client, ctx, "progress")
    _submit(client, ctx, 100)
    client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress/approve",
        headers=ctx["seeker_headers"],
    )
    _pay(client, ctx, "final")
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/complete",
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 200, resp.text

    resp = _sign(client, ctx["seeker_headers"], ctx["contract_id"])
    assert resp.status_code == 409
    assert _error_code(resp) == "CONTRACT_NOT_SIGNABLE"


# --------------------------------------------------------------------------
# 25/50/25 values
# --------------------------------------------------------------------------


def test_payment_values_sum_exactly_to_total(client: TestClient):
    ctx = _full_active(client)
    body = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    stages = body["milestones"]
    assert [s["amount"] for s in stages] == [100.0, 200.0, 100.0]
    assert round(sum(s["amount"] for s in stages), 2) == body["agreedPrice"] == 400


# --------------------------------------------------------------------------
# Progress: 60% checkpoint + final submission
# --------------------------------------------------------------------------


def _pay(client, ctx, kind):
    body = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    stage = _stage(body, kind)
    resp = _patch_stage(
        client, ctx["seeker_headers"], ctx["contract_id"], stage["id"], "paid"
    )
    assert resp.status_code == 200, resp.text


def _submit(client, ctx, progress):
    return client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress",
        json={"progress": progress},
        headers=ctx["provider_headers"],
    )


def test_provider_cannot_submit_60_before_initial_paid(client: TestClient):
    ctx = _full_active(client)
    resp = _submit(client, ctx, 60)
    assert resp.status_code == 409
    assert _error_code(resp) == "PROGRESS_NOT_DUE"


def test_provider_submits_60_and_stage_awaiting(client: TestClient):
    ctx = _full_active(client)
    _pay(client, ctx, "initial")
    resp = _submit(client, ctx, 60)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert _stage(body, "progress")["status"] == "awaiting_approval"
    assert body["projectProgress"] == 25  # unchanged until approved


def test_seeker_cannot_submit_progress(client: TestClient):
    ctx = _full_active(client)
    _pay(client, ctx, "initial")
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress",
        json={"progress": 60},
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "PROVIDER_ONLY"


def test_invalid_progress_value_rejected(client: TestClient):
    ctx = _full_active(client)
    _pay(client, ctx, "initial")
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress",
        json={"progress": 37},
        headers=ctx["provider_headers"],
    )
    assert resp.status_code == 422


def test_double_submission_rejected(client: TestClient):
    ctx = _full_active(client)
    _pay(client, ctx, "initial")
    assert _submit(client, ctx, 60).status_code == 200
    resp = _submit(client, ctx, 60)
    assert resp.status_code == 409
    assert _error_code(resp) == "PROGRESS_ALREADY_SUBMITTED"


def test_approve_60_makes_progress_stage_due(client: TestClient):
    ctx = _full_active(client)
    _pay(client, ctx, "initial")
    _submit(client, ctx, 60)

    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress/approve",
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["projectProgress"] == 60
    assert _stage(body, "progress")["status"] == "due"  # due, NOT paid


def test_provider_cannot_approve_progress(client: TestClient):
    ctx = _full_active(client)
    _pay(client, ctx, "initial")
    _submit(client, ctx, 60)
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress/approve",
        headers=ctx["provider_headers"],
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "SEEKER_ONLY"


def test_approve_with_nothing_pending_rejected(client: TestClient):
    ctx = _full_active(client)
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress/approve",
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "NO_PENDING_PROGRESS"


def test_final_submission_and_completion_flow(client: TestClient):
    ctx = _full_active(client)
    # initial
    _pay(client, ctx, "initial")
    # 60% checkpoint
    _submit(client, ctx, 60)
    client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress/approve",
        headers=ctx["seeker_headers"],
    )
    _pay(client, ctx, "progress")
    # final
    resp = _submit(client, ctx, 100)
    assert resp.status_code == 200, resp.text
    assert _stage(resp.json(), "final")["status"] == "awaiting_approval"

    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress/approve",
        headers=ctx["seeker_headers"],
    )
    body = resp.json()
    assert body["projectProgress"] == 100
    assert _stage(body, "final")["status"] == "due"
    _pay(client, ctx, "final")

    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/complete", headers=ctx["seeker_headers"]
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "completed"
    assert resp.json()["completedAt"] is not None


def test_cannot_submit_final_before_60_approved(client: TestClient):
    ctx = _full_active(client)
    _pay(client, ctx, "initial")
    resp = _submit(client, ctx, 100)
    assert resp.status_code == 409
    assert _error_code(resp) == "PROGRESS_NOT_DUE"


# --------------------------------------------------------------------------
# Revisions
# --------------------------------------------------------------------------


def test_revision_request_increments_usage(client: TestClient):
    ctx = _full_active(client)
    _pay(client, ctx, "initial")
    _submit(client, ctx, 60)

    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress/revision",
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["revisionsUsed"] == 1
    # Submission cleared back to not_due so provider can resubmit.
    assert _stage(body, "progress")["status"] == "not_due"


def test_revision_exhausted_returns_amendment_error(client: TestClient):
    ctx = _full_active(client)
    _pay(client, ctx, "initial")
    for _ in range(2):  # includedRevisionCount default = 2
        _submit(client, ctx, 60)
        resp = client.post(
            f"{API}/contracts/{ctx['contract_id']}/progress/revision",
            headers=ctx["seeker_headers"],
        )
        assert resp.status_code == 200
        _submit(client, ctx, 60)

    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress/revision",
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "REVISIONS_EXHAUSTED"


def test_provider_cannot_request_revision(client: TestClient):
    ctx = _full_active(client)
    _pay(client, ctx, "initial")
    _submit(client, ctx, 60)
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress/revision",
        headers=ctx["provider_headers"],
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "SEEKER_ONLY"


# --------------------------------------------------------------------------
# Edits / amendments
# --------------------------------------------------------------------------


def test_amendment_proposal_does_not_touch_live_contract(client: TestClient):
    ctx = _full_active(client)
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/amendments",
        json={"changes": {"scope": "Updated scope text"}, "reason": "clarify"},
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "pending"
    assert resp.json()["editNumber"] == 1

    # Live contract unchanged until approval.
    body = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    assert body["scope"] != "Updated scope text"
    assert body["contractEditCount"] == 0


def test_amendment_approval_applies_and_increments(client: TestClient):
    ctx = _full_active(client)
    amend = client.post(
        f"{API}/contracts/{ctx['contract_id']}/amendments",
        json={"changes": {"scope": "Updated scope text"}},
        headers=ctx["seeker_headers"],
    ).json()

    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/amendments/{amend['id']}/approve",
        headers=ctx["provider_headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "approved"

    body = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    assert body["scope"] == "Updated scope text"
    assert body["contractEditCount"] == 1
    assert body["calculatedEditFee"] == 0.0  # first edit free


def test_proposer_cannot_approve_own_amendment(client: TestClient):
    ctx = _full_active(client)
    amend = client.post(
        f"{API}/contracts/{ctx['contract_id']}/amendments",
        json={"changes": {"scope": "Updated scope text"}},
        headers=ctx["seeker_headers"],
    ).json()
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/amendments/{amend['id']}/approve",
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_AMENDMENT_APPROVER"


def test_third_edit_computes_2_5_pct(client: TestClient):
    ctx = _full_active(client)  # agreed price 400

    def amend_and_approve(field_value):
        amend = client.post(
            f"{API}/contracts/{ctx['contract_id']}/amendments",
            json={"changes": {"scope": field_value}},
            headers=ctx["seeker_headers"],
        ).json()
        client.post(
            f"{API}/contracts/{ctx['contract_id']}/amendments/{amend['id']}/approve",
            headers=ctx["provider_headers"],
        )

    amend_and_approve("v1")  # edit 1: free
    body = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    assert body["contractEditCount"] == 1
    assert body["calculatedEditFee"] == 0.0

    amend_and_approve("v2")  # edit 2: free
    body = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    assert body["contractEditCount"] == 2
    assert body["calculatedEditFee"] == 0.0

    amend_and_approve("v3")  # edit 3: 2.5% of 400 = 10.0
    body = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    assert body["contractEditCount"] == 3
    assert body["calculatedEditFee"] == 10.0


def test_edit_fee_caps_at_7_5_pct(client: TestClient):
    ctx = _full_active(client)  # agreed price 400

    def amend_and_approve(value):
        amend = client.post(
            f"{API}/contracts/{ctx['contract_id']}/amendments",
            json={"changes": {"scope": value}},
            headers=ctx["seeker_headers"],
        ).json()
        client.post(
            f"{API}/contracts/{ctx['contract_id']}/amendments/{amend['id']}/approve",
            headers=ctx["provider_headers"],
        )

    for i in range(6):
        amend_and_approve(f"v{i}")

    body = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    assert body["contractEditCount"] == 6
    # 6 edits: billable = 4, 4*2.5 = 10 -> capped at 7.5% of 400 = 30.0
    assert body["calculatedEditFee"] == 30.0


def test_amendment_rejected_leaves_contract(client: TestClient):
    ctx = _full_active(client)
    amend = client.post(
        f"{API}/contracts/{ctx['contract_id']}/amendments",
        json={"changes": {"scope": "Nope"}},
        headers=ctx["seeker_headers"],
    ).json()
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/amendments/{amend['id']}/reject",
        headers=ctx["provider_headers"],
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"
    body = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    assert body["contractEditCount"] == 0


def test_normal_edits_blocked_after_60_pct(client: TestClient):
    ctx = _full_active(client)
    _pay(client, ctx, "initial")
    _submit(client, ctx, 60)
    client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress/approve",
        headers=ctx["seeker_headers"],
    )
    progress_body = _contract(
        client, ctx["seeker_headers"], ctx["contract_id"]
    )
    assert progress_body["projectProgress"] == 60

    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/amendments",
        json={"changes": {"scope": "Too late"}},
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "CONTRACT_EDIT_LOCKED"


def test_only_amendable_fields_accepted(client: TestClient):
    ctx = _full_active(client)
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/amendments",
        json={"changes": {"agreedPrice": 1}},
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 422


# --------------------------------------------------------------------------
# Disputes
# --------------------------------------------------------------------------


def test_either_participant_can_raise_dispute(client: TestClient):
    ctx = _full_active(client)
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/disputes",
        json={"reason": "scope_mismatch", "description": "Not what I asked."},
        headers=ctx["provider_headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "open"
    assert resp.json()["reason"] == "scope_mismatch"

    body = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    assert body["status"] == "disputed"
    assert body["hasOpenDispute"] is True


def test_unrelated_user_cannot_raise_dispute(client: TestClient):
    ctx = _full_active(client)
    stranger_headers, _ = _signup(client, ["seeker"], "Stranger")
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/disputes",
        json={"reason": "other"},
        headers=stranger_headers,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_CONTRACT_PARTICIPANT"


def test_dispute_no_automatic_refund_or_payment(client: TestClient):
    ctx = _full_active(client)
    _pay(client, ctx, "initial")
    before = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    client.post(
        f"{API}/contracts/{ctx['contract_id']}/disputes",
        json={"reason": "payment_disagreement"},
        headers=ctx["seeker_headers"],
    )
    after = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    # No stage changed to paid; revenue side untouched.
    assert _stage(after, "initial")["status"] == "paid"
    assert _stage(after, "progress")["status"] == _stage(before, "progress")["status"]
    assert after["projectProgress"] == before["projectProgress"]


def test_dispute_resolve_restores_active(client: TestClient):
    ctx = _full_active(client)
    dispute = client.post(
        f"{API}/contracts/{ctx['contract_id']}/disputes",
        json={"reason": "communication_issue"},
        headers=ctx["seeker_headers"],
    ).json()

    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/disputes/{dispute['id']}/resolve",
        headers=ctx["provider_headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "active"
    assert body["hasOpenDispute"] is False


def test_invalid_dispute_reason_rejected(client: TestClient):
    ctx = _full_active(client)
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/disputes",
        json={"reason": "made_up"},
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 422


# --------------------------------------------------------------------------
# Cancellation
# --------------------------------------------------------------------------


def test_cancellation_request_is_recorded_not_terminal(client: TestClient):
    ctx = _full_active(client)
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/cancellation-request",
        json={"reason": "Found another provider"},
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Contract is NOT cancelled or deleted.
    assert body["status"] == "active"
    assert body["cancellationRequested"] is True
    assert body["cancellationReason"] == "Found another provider"
    assert body["cancellationRequestedAt"] is not None
    assert body["cancellationProgressSnapshot"] == 0
    # Non-binding informational estimate exposed (up to 5%).
    assert body["cancellationTerminationEstimatePct"] == 5.0


def test_cancellation_needs_other_party_approval(client: TestClient):
    ctx = _full_active(client)
    client.post(
        f"{API}/contracts/{ctx['contract_id']}/cancellation-request",
        json={"reason": "changed my mind"},
        headers=ctx["seeker_headers"],
    )
    # Requester cannot approve their own request.
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/cancellation-request/approve",
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_CANCELLATION_APPROVER"

    # Other party approves -> cancelled.
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/cancellation-request/approve",
        headers=ctx["provider_headers"],
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_cancellation_without_request_rejected(client: TestClient):
    ctx = _full_active(client)
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/cancellation-request/approve",
        headers=ctx["provider_headers"],
    )
    assert resp.status_code == 409
    assert _error_code(resp) == "NO_CANCELLATION_REQUEST"


def test_unrelated_user_cannot_request_cancellation(client: TestClient):
    ctx = _full_active(client)
    stranger_headers, _ = _signup(client, ["seeker"], "Stranger")
    resp = client.post(
        f"{API}/contracts/{ctx['contract_id']}/cancellation-request",
        json={"reason": "nope"},
        headers=stranger_headers,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_CONTRACT_PARTICIPANT"


# --------------------------------------------------------------------------
# History
# --------------------------------------------------------------------------


def test_history_records_key_events(client: TestClient):
    ctx = _full_active(client)
    _pay(client, ctx, "initial")
    _submit(client, ctx, 60)
    client.post(
        f"{API}/contracts/{ctx['contract_id']}/progress/approve",
        headers=ctx["seeker_headers"],
    )

    resp = client.get(
        f"{API}/contracts/{ctx['contract_id']}/history",
        headers=ctx["seeker_headers"],
    )
    assert resp.status_code == 200
    body = resp.json()
    # Every list endpoint keeps the pagination envelope.
    assert set(body.keys()) == ENVELOPE_KEYS
    assert body["total"] >= 6
    actions = [item["action"] for item in body["items"]]
    assert "contract_generated" in actions
    assert "contract_signed" in actions
    assert "contract_activated" in actions
    assert "payment_stage_changed" in actions
    assert "progress_submitted" in actions
    assert "progress_approved" in actions
    # camelCase serialization
    for item in body["items"]:
        assert set(item.keys()) == {
            "id",
            "contractId",
            "actorId",
            "action",
            "details",
            "createdAt",
        }


def test_contract_subresource_lists_use_envelope(client: TestClient):
    ctx = _full_active(client)
    # Amendment first (requires an active contract), then the dispute.
    client.post(
        f"{API}/contracts/{ctx['contract_id']}/amendments",
        json={"changes": {"scope": "new scope"}},
        headers=ctx["seeker_headers"],
    )
    client.post(
        f"{API}/contracts/{ctx['contract_id']}/disputes",
        json={"reason": "other"},
        headers=ctx["seeker_headers"],
    )
    for path in ("history", "disputes", "amendments"):
        resp = client.get(
            f"{API}/contracts/{ctx['contract_id']}/{path}",
            headers=ctx["seeker_headers"],
        )
        assert resp.status_code == 200, path
        assert set(resp.json().keys()) == ENVELOPE_KEYS, path
        assert resp.json()["total"] >= 1, path


def test_history_participant_only(client: TestClient):
    ctx = _full_active(client)
    stranger_headers, _ = _signup(client, ["seeker"], "Stranger")
    resp = client.get(
        f"{API}/contracts/{ctx['contract_id']}/history",
        headers=stranger_headers,
    )
    assert resp.status_code == 403
    assert _error_code(resp) == "NOT_CONTRACT_PARTICIPANT"


# --------------------------------------------------------------------------
# Serialization
# --------------------------------------------------------------------------


def test_contract_response_is_camel_case_and_complete(client: TestClient):
    ctx = _full_active(client)
    body = _contract(client, ctx["seeker_headers"], ctx["contract_id"])
    expected = {
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
        "scope",
        "finalDeadline",
        "includedRevisionCount",
        "revisionsUsed",
        "ownershipOption",
        "portfolioPermission",
        "confidentialityAgreed",
        "termsVersion",
        "askSideSignedAt",
        "respondSideSignedAt",
        "projectProgress",
        "contractEditCount",
        "calculatedEditFee",
        "projectValue",
        "platformFee",
        "providerCommission",
        "cancellationRequested",
        "cancellationReason",
        "cancellationRequestedAt",
        "cancellationProgressSnapshot",
        "cancellationTerminationEstimatePct",
        "hasOpenDispute",
    }
    assert set(body.keys()) == expected
