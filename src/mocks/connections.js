// Seed connection records between existing mock users, so Discover People,
// Profile and /app/connections aren't empty on first load. UASK connections
// are immediate (Connect -> Connected, no request/approval step) — see
// services/connectionService.js — so every record here is already
// "connected", there's no pending state to seed.
export const connections = [
  {
    id: 'conn-seed-1',
    fromUserId: 'user-2',
    toUserId: 'user-4',
    connectedAt: '2026-06-02T10:00:00.000Z',
  },
  {
    id: 'conn-seed-2',
    fromUserId: 'user-1',
    toUserId: 'user-5',
    connectedAt: '2026-07-11T09:00:00.000Z',
  },
  {
    id: 'conn-seed-3',
    fromUserId: 'user-6',
    toUserId: 'user-2',
    connectedAt: '2026-09-20T15:45:00.000Z',
  },
]
