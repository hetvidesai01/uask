"""Backend Contract Alignment Phase 5 — global search: asks, people, combined."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User

API = "/api/v1"

ASK_KEYS = {
    "id",
    "title",
    "description",
    "category",
    "budgetMin",
    "budgetMax",
    "currency",
    "deadline",
    "location",
    "isRemote",
    "status",
    "attachments",
    "requesterId",
    "responseCount",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "requester",
}
USER_PUBLIC_KEYS = {"id", "name", "avatarUrl", "rating", "reviewCount"}
PROFILE_KEYS = {
    "id",
    "name",
    "avatarUrl",
    "bio",
    "location",
    "categories",
    "roles",
    "rating",
    "reviewCount",
    "joinedAt",
}
COMBINED_KEYS = {"asks", "people"}


def _error_code(resp) -> str:
    return resp.json()["error"]["code"]


def _signup(
    client: TestClient, roles: list[str], *, name: str = "Searcher"
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


def _profile(client: TestClient, headers: dict, **fields) -> dict:
    me = client.get(f"{API}/auth/me", headers=headers).json()
    resp = client.patch(
        f"{API}/users/{me['id']}", json=fields, headers=headers
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


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


def _search_asks(client: TestClient, headers: dict, **params) -> list[dict]:
    resp = client.get(f"{API}/search/asks", params=params, headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, list), "search groups are bare arrays"
    return body


def _search_people(client: TestClient, headers: dict, **params) -> list[dict]:
    resp = client.get(f"{API}/search/people", params=params, headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, list), "search groups are bare arrays"
    return body


def _search(client: TestClient, headers: dict, **params) -> dict:
    resp = client.get(f"{API}/search", params=params, headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert set(body) == COMBINED_KEYS
    return body


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------


def test_search_endpoints_require_auth(client: TestClient):
    for path in ("/search/asks", "/search/people", "/search"):
        resp = client.get(f"{API}{path}", params={"q": "logo"})
        assert resp.status_code == 401, f"{path}: {resp.text}"


# --------------------------------------------------------------------------
# ASK search
# --------------------------------------------------------------------------


def test_ask_search_matches_title(client: TestClient):
    headers, _ = _signup(client, ["seeker"], name="Title Seeker")
    ask = _create_ask(client, headers)

    results = _search_asks(client, headers, q="logo")

    assert len(results) == 1
    assert results[0]["id"] == ask["id"]
    assert set(results[0]) == ASK_KEYS
    assert set(results[0]["requester"]) == USER_PUBLIC_KEYS


def test_ask_search_matches_description(client: TestClient):
    headers, _ = _signup(client, ["seeker"], name="Desc Seeker")
    ask = _create_ask(
        client,
        headers,
        title="Need signage for the shop front",
    )

    results = _search_asks(client, headers, q="storefront")

    assert [r["id"] for r in results] == [ask["id"]]


def test_ask_search_matches_category(client: TestClient):
    headers, _ = _signup(client, ["seeker"], name="Category Seeker")
    ask = _create_ask(
        client,
        headers,
        title="Need help with weekly maths homework",
        description=(
            "Looking for someone to guide me through arithmetic practice "
            "every weekend evening for the next two months."
        ),
        category="Tutoring",
    )

    results = _search_asks(client, headers, q="tutoring")

    assert [r["id"] for r in results] == [ask["id"]]
    assert results[0]["category"] == "Tutoring"


def test_ask_search_is_case_insensitive(client: TestClient):
    headers, _ = _signup(client, ["seeker"], name="Case Seeker")
    _create_ask(client, headers)

    for term in ("LOGO", "LoGo", "logo"):
        assert len(_search_asks(client, headers, q=term)) == 1, term


def test_ask_search_empty_query_returns_empty(client: TestClient):
    headers, _ = _signup(client, ["seeker"], name="Empty Seeker")
    _create_ask(client, headers)

    for params in ({}, {"q": ""}, {"q": "   "}):
        assert _search_asks(client, headers, **params) == [], params


def test_ask_search_excludes_soft_deleted_ask(client: TestClient):
    headers, _ = _signup(client, ["seeker"], name="Delete Seeker")
    ask = _create_ask(client, headers)
    assert len(_search_asks(client, headers, q="logo")) == 1

    resp = client.delete(f"{API}/asks/{ask['id']}", headers=headers)
    assert resp.status_code == 204, resp.text

    assert _search_asks(client, headers, q="logo") == []


def test_ask_search_respects_limit(client: TestClient):
    headers, _ = _signup(client, ["seeker"], name="Limit Seeker")
    titles = [
        "Need a professional logo design",
        "Need a second logo exploration",
        "Need a third logo variant pack",
    ]
    for title in titles:
        _create_ask(client, headers, title=title)

    assert len(_search_asks(client, headers, q="logo", limit=2)) == 2
    assert len(_search_asks(client, headers, q="logo")) == 3


def test_ask_search_ranks_title_match_before_description_match(
    client: TestClient,
):
    headers, _ = _signup(client, ["seeker"], name="Rank Seeker")
    title_hit = _create_ask(client, headers)
    description_hit = _create_ask(
        client,
        headers,
        title="Need artwork for the cafe menu",
        description=(
            "Looking for printed menu boards and coasters that pair with "
            "our existing logo file from last season."
        ),
    )

    results = _search_asks(client, headers, q="logo")

    assert [r["id"] for r in results] == [title_hit["id"], description_hit["id"]]


def test_ask_search_trims_query(client: TestClient):
    headers, _ = _signup(client, ["seeker"], name="Trim Seeker")
    _create_ask(client, headers)

    assert len(_search_asks(client, headers, q="  logo  ")) == 1


def test_ask_search_no_match_returns_empty(client: TestClient):
    headers, _ = _signup(client, ["seeker"], name="Miss Seeker")
    _create_ask(client, headers)

    assert _search_asks(client, headers, q="xyzzy-not-present") == []


# --------------------------------------------------------------------------
# People search
# --------------------------------------------------------------------------


def test_people_search_matches_name(client: TestClient):
    searcher, _ = _signup(client, ["seeker"], name="Sam Searcher")
    _, target_id = _signup(client, ["provider"], name="Priya Painter")

    for term in ("priya", "PRIYA"):
        results = _search_people(client, searcher, q=term)
        assert [u["id"] for u in results] == [target_id], term

    assert set(results[0]) == PROFILE_KEYS


def test_people_search_matches_bio(client: TestClient):
    searcher, _ = _signup(client, ["seeker"], name="Bio Searcher")
    target_headers, target_id = _signup(client, ["provider"], name="Bio Target")
    _profile(
        client,
        target_headers,
        bio="Watercolour mural artist for cafes and offices.",
    )

    results = _search_people(client, searcher, q="watercolour")

    assert [u["id"] for u in results] == [target_id]


def test_people_search_matches_location(client: TestClient):
    searcher, _ = _signup(client, ["seeker"], name="Place Searcher")
    target_headers, target_id = _signup(client, ["provider"], name="Lis Resident")
    _profile(client, target_headers, location="Lisbon, Portugal")

    results = _search_people(client, searcher, q="LISBON")

    assert [u["id"] for u in results] == [target_id]


def test_people_search_matches_categories(client: TestClient):
    searcher, _ = _signup(client, ["seeker"], name="Skill Searcher")
    target_headers, target_id = _signup(client, ["provider"], name="Lens Worker")
    _profile(client, target_headers, categories=["Photography"])

    results = _search_people(client, searcher, q="photography")

    assert [u["id"] for u in results] == [target_id]
    assert results[0]["categories"] == ["Photography"]


def test_people_search_excludes_current_user(client: TestClient):
    me, me_id = _signup(client, ["seeker"], name="Alone Matcher")
    _, other_id = _signup(client, ["provider"], name="Alone Companion")

    results = _search_people(client, me, q="alone")

    assert [u["id"] for u in results] == [other_id]
    assert me_id not in [u["id"] for u in results]


def test_people_search_excludes_inactive_users(
    client: TestClient, db: Session
):
    searcher, _ = _signup(client, ["seeker"], name="Active Searcher")
    _, target_id = _signup(client, ["provider"], name="Deactivated Dan")
    assert len(_search_people(client, searcher, q="deactivated")) == 1

    user = db.get(User, uuid.UUID(target_id))
    user.is_active = False
    db.commit()

    assert _search_people(client, searcher, q="deactivated") == []


def test_people_search_never_leaks_private_contact_fields(
    client: TestClient,
):
    searcher, _ = _signup(client, ["seeker"], name="Privacy Searcher")
    target_headers, _ = _signup(client, ["provider"], name="Private Pat")
    _profile(
        client,
        target_headers,
        bio="Contactable illustrator for editorial work.",
        linkedin="https://linkedin.com/in/private-pat",
        instagram="@privatepat",
        contactEmail="private.pat@example.com",
    )

    results = _search_people(client, searcher, q="contactable")

    assert len(results) == 1
    keys = set(results[0])
    assert keys == PROFILE_KEYS
    assert not keys & {"email", "linkedin", "instagram", "contactEmail"}


def test_people_search_respects_limit(client: TestClient):
    searcher, _ = _signup(client, ["seeker"], name="Bulk Searcher")
    for suffix in ("One", "Two", "Three"):
        _signup(client, ["provider"], name=f"Findable {suffix}")

    assert len(_search_people(client, searcher, q="findable", limit=2)) == 2
    assert len(_search_people(client, searcher, q="findable")) == 3


def test_people_search_empty_query_returns_empty(client: TestClient):
    searcher, _ = _signup(client, ["seeker"], name="Blank Searcher")
    _signup(client, ["provider"], name="Findable Person")

    for params in ({}, {"q": ""}, {"q": "   "}):
        assert _search_people(client, searcher, **params) == [], params


def test_people_search_no_match_returns_empty(client: TestClient):
    searcher, _ = _signup(client, ["seeker"], name="Miss Searcher")

    assert _search_people(client, searcher, q="xyzzy-not-present") == []


# --------------------------------------------------------------------------
# Combined search
# --------------------------------------------------------------------------


def test_combined_search_returns_grouped_results(client: TestClient):
    seeker, _ = _signup(client, ["seeker"], name="Sam Searcher")
    _, person_id = _signup(client, ["provider"], name="Doris Design")
    ask = _create_ask(client, seeker)

    body = _search(client, seeker, q="design")

    assert [a["id"] for a in body["asks"]] == [ask["id"]]
    assert [p["id"] for p in body["people"]] == [person_id]


def test_combined_search_respects_limit_per_group(client: TestClient):
    seeker, _ = _signup(client, ["seeker"], name="Sam Searcher")
    for suffix in ("One", "Two", "Three"):
        _signup(client, ["provider"], name=f"Limitable {suffix}")
    for letter in ("a", "b", "c"):
        _create_ask(
            client, seeker, title=f"Limitable poster job {letter}"
        )

    body = _search(client, seeker, q="limitable", limit=2)

    assert len(body["asks"]) == 2
    assert len(body["people"]) == 2


def test_combined_search_empty_query_returns_empty_groups(
    client: TestClient,
):
    seeker, _ = _signup(client, ["seeker"], name="Sam Searcher")
    _create_ask(client, seeker)
    _signup(client, ["provider"], name="Doris Design")

    for params in ({}, {"q": ""}, {"q": "   "}):
        assert _search(client, seeker, **params) == {
            "asks": [],
            "people": [],
        }, params


# --------------------------------------------------------------------------
# Query validation
# --------------------------------------------------------------------------


def test_limit_is_validated_on_every_endpoint(client: TestClient):
    headers, _ = _signup(client, ["seeker"], name="Validator")
    for path in ("/search/asks", "/search/people", "/search"):
        for limit in (0, 51, -1):
            resp = client.get(
                f"{API}{path}",
                params={"q": "a", "limit": limit},
                headers=headers,
            )
            assert resp.status_code == 422, f"{path}?limit={limit}"


def test_query_capped_at_200_characters(client: TestClient):
    headers, _ = _signup(client, ["seeker"], name="Validator")
    resp = client.get(
        f"{API}/search/asks",
        params={"q": "x" * 201},
        headers=headers,
    )
    assert resp.status_code == 422
    assert _error_code(resp) == "VALIDATION_ERROR"
