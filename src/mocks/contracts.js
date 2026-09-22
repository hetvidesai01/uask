// One contract per already-accepted offer in mocks/offers.js. This is
// deliberately the smallest shape the Payments/Milestones dashboard needs —
// the full Contract screen (Product Change Phase 5) will extend it.
export const contracts = [
  {
    id: 'contract-1',
    askId: 'ask-2',
    offerId: 'offer-3',
    seekerId: 'user-2',
    providerId: 'user-6',
    agreedPrice: 220,
    currency: 'USD',
    deliverables: ['Full page rewrite', 'Headline options', '1 revision round'],
    status: 'active',
    // The seeker's rating for the provider, given once the contract is
    // completed — null until then.
    rating: null,
    createdAt: '2026-09-11T09:00:00.000Z',
    milestones: [
      {
        id: 'milestone-1-1',
        title: 'First draft delivered',
        amount: 100,
        dueDate: '2026-09-14T00:00:00.000Z',
        status: 'paid',
      },
      {
        id: 'milestone-1-2',
        title: 'Final revisions & handoff',
        amount: 120,
        dueDate: '2026-09-26T00:00:00.000Z',
        status: 'due',
      },
    ],
  },
  {
    id: 'contract-2',
    askId: 'ask-6',
    offerId: 'offer-9',
    seekerId: 'user-3',
    providerId: 'user-5',
    agreedPrice: 780,
    currency: 'USD',
    deliverables: ['Post replacement', 'Board repair', 'Re-stain repaired area'],
    status: 'completed',
    rating: 4.8,
    createdAt: '2026-08-29T10:00:00.000Z',
    milestones: [
      {
        id: 'milestone-2-1',
        title: 'Post replacement',
        amount: 300,
        dueDate: '2026-09-02T00:00:00.000Z',
        status: 'completed',
      },
      {
        id: 'milestone-2-2',
        title: 'Board repair',
        amount: 280,
        dueDate: '2026-09-05T00:00:00.000Z',
        status: 'completed',
      },
      {
        id: 'milestone-2-3',
        title: 'Re-stain repaired area',
        amount: 200,
        dueDate: '2026-09-08T00:00:00.000Z',
        status: 'completed',
      },
    ],
  },
  {
    id: 'contract-3',
    askId: 'ask-7',
    offerId: 'offer-13',
    seekerId: 'user-1',
    providerId: 'user-6',
    agreedPrice: 350,
    currency: 'USD',
    deliverables: ['Event timeline', 'Vendor coordination', 'Day-of support'],
    status: 'active',
    rating: null,
    createdAt: '2026-09-06T09:00:00.000Z',
    milestones: [
      {
        id: 'milestone-3-1',
        title: 'Planning & vendor booking',
        amount: 150,
        dueDate: '2026-09-20T00:00:00.000Z',
        status: 'paid',
      },
      {
        id: 'milestone-3-2',
        title: 'Day-of coordination',
        amount: 200,
        dueDate: '2026-10-05T00:00:00.000Z',
        status: 'upcoming',
      },
    ],
  },
]
