from typing import Literal

from pydantic import Field

from app.schemas.base import CamelModel
from app.schemas.offer import OfferResponse
from app.schemas.user import UserPublic

MatchLabel = Literal["Excellent Match", "Strong Match", "Relevant"]
MatchStrength = Literal[
    "Best value", "Fastest delivery", "Highest rated", "Strongest portfolio fit"
]


class RankedResponse(CamelModel):
    """One submitted response, scored. Contract shape — keep the keys stable."""

    offer: OfferResponse
    provider: UserPublic
    score: int = Field(ge=0, le=100)
    label: MatchLabel
    reasons: list[str] = Field(default_factory=list, max_length=3)
    rating: float = Field(ge=0, le=5)
    # null until Contracts/Reputation provide real completed-project data.
    similar_project_count: int | None = None
    strength: MatchStrength | None = None
