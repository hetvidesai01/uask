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
│   ├── utils/            # Utilities
│   └── main.py           # FastAPI app
├── alembic/              # Database migrations
├── tests/                # Test suite
├── pyproject.toml        # Project config
└── docker-compose.yml    # PostgreSQL service
```
