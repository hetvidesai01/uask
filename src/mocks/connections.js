// Seed connection records between existing mock users, so Discover People,
// Profile and /app/connections aren't empty on first load. Runtime changes
// (new requests, accepts, removals) are persisted separately — see
// services/connectionService.js.
export const connections = [
  {
    id: 'conn-seed-1',
    fromUserId: 'user-2',
    toUserId: 'user-4',
    status: 'accepted',
    createdAt: '2026-06-02T10:00:00.000Z',
    respondedAt: '2026-06-02T18:00:00.000Z',
  },
  {
    id: 'conn-seed-2',
    fromUserId: 'user-1',
    toUserId: 'user-5',
    status: 'accepted',
    createdAt: '2026-07-11T09:00:00.000Z',
    respondedAt: '2026-07-11T20:30:00.000Z',
  },
  {
    id: 'conn-seed-3',
    fromUserId: 'user-6',
    toUserId: 'user-2',
    status: 'pending',
    createdAt: '2026-09-20T15:45:00.000Z',
    respondedAt: null,
  },
]
