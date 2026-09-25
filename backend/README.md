# UASK Backend

## Setup

1. Copy `.env.example` to `.env` and update values as needed:
   ```bash
   cp .env.example .env
   ```

2. Start PostgreSQL:
   ```bash
   docker compose up -d
   ```

3. Create a virtual environment and install dependencies:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   pip install -e ".[dev]"
   ```

4. Run database migrations:
   ```bash
   alembic upgrade head
   ```

5. Start the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

6. Verify the API is running:
   ```
   GET http://localhost:8000/api/v1/health
   ```

## Seed Development Data

Generate realistic local data (6 users, 8 ASKs, 15 offers) after migrations:

```bash
python scripts/seed.py           # seed an empty development database
python scripts/seed.py --reset   # wipe all tables, then seed fresh data
```

Without `--reset` the script refuses to touch a database that already
contains data, so re-running it is always safe. It also refuses to run when
`ENV` is not `development` or `test` — seeding never happens in production,
and seed data lives only in `scripts/seed.py`, never in migrations.

Seeded accounts (password for all: `password123`):

| Email              | Roles             | Name          |
| ------------------ | ----------------- | ------------- |
| alice@uask.dev     | seeker            | Alice Rivera  |
| bob@uask.dev       | seeker            | Bob Patel     |
| carol@uask.dev     | provider          | Carol Nguyen  |
| dave@uask.dev      | provider          | Dave Kim      |
| erin@uask.dev      | provider          | Erin Sato     |
| frank@uask.dev     | seeker,provider   | Frank Osei    |

ASK states: 5 open (all 8 categories covered), 2 closed with accepted and
rejected offers, 1 cancelled. `alice@uask.dev`'s logo ASK has 4 live offers
for exercising the compare endpoint.

## Project Structure

```
backend/
├── app/
│   ├── api/v1/routes/    # Route handlers
│   ├── core/             # Config, dependencies
│   ├── db/               # Base, session
│   ├── models/           # SQLAlchemy models (Phase 2)
│   ├── schemas/          # Pydantic schemas (Phase 2)
│   ├── repositories/     # Data access (Phase 2)
│   ├── services/         # Business logic (Phase 2)
│   ├── storage/          # Storage backend interface (local, later S3/Supabase)
│   ├── utils/            # Utilities
│   └── main.py           # FastAPI app
├── alembic/              # Database migrations
├── tests/                # Test suite
├── pyproject.toml        # Project config
└── docker-compose.yml    # PostgreSQL service
```
