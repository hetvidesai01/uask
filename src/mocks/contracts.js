// One contract per already-accepted offer in mocks/offers.js.
//
// Milestone status is a linear flow driven by explicit user actions:
//   upcoming/in_progress --[provider submits]--> submitted
//   submitted            --[client approves]-->  approved
//   approved             --[client pays, mock]--> paid
//
// Contract status is separate: 'active' until every milestone is 'paid'
// and the client marks the project completed, then 'completed'. `rating`
// and `review` are set once, by the client, after completion.
export const contracts = [
  {
    id: 'contract-1',
    askId: 'ask-2',
    offerId: 'offer-3',
    seekerId: 'user-2',
    providerId: 'user-6',
    agreedPrice: 17600,
    currency: 'INR',
    deliverables: ['Full page rewrite', 'Headline options', '1 revision round'],
    status: 'active',
    rating: null,
    review: null,
    createdAt: '2026-09-11T09:00:00.000Z',
    completedAt: null,
    milestones: [
      {
        id: 'milestone-1-1',
        title: 'First draft delivered',
        description: 'Full first-pass rewrite of the landing page copy, ready for review.',
        amount: 8000,
        dueDate: '2026-09-14T00:00:00.000Z',
        status: 'paid',
      },
      {
        id: 'milestone-1-2',
        title: 'Final revisions & handoff',
        description: 'Incorporate feedback, deliver final copy doc and headline options.',
        amount: 9600,
        dueDate: '2026-09-26T00:00:00.000Z',
        status: 'approved',
      },
    ],
  },
  {
    id: 'contract-2',
    askId: 'ask-6',
    offerId: 'offer-9',
    seekerId: 'user-3',
    providerId: 'user-7',
    agreedPrice: 36000,
    currency: 'INR',
    deliverables: ['Product photo shoot (20 items)', 'Photo editing & color correction', 'High-res + web-optimized exports'],
    status: 'completed',
    rating: 4.9,
    review: "Noah's product shots elevated our whole storefront — quick turnaround and beautiful editing.",
    createdAt: '2026-08-29T10:00:00.000Z',
    completedAt: '2026-09-09T16:00:00.000Z',
    milestones: [
      {
        id: 'milestone-2-1',
        title: 'Photo shoot completed',
        description: 'On-site shoot covering all 20 products, white background plus lifestyle angles.',
        amount: 16000,
        dueDate: '2026-09-02T00:00:00.000Z',
        status: 'paid',
      },
      {
        id: 'milestone-2-2',
        title: 'Editing & final delivery',
        description: 'Color correction, retouching, and export in web-optimized and high-res formats.',
        amount: 20000,
        dueDate: '2026-09-08T00:00:00.000Z',
        status: 'paid',
      },
    ],
  },
  {
    id: 'contract-3',
    askId: 'ask-7',
    offerId: 'offer-13',
    seekerId: 'user-1',
    providerId: 'user-6',
    agreedPrice: 28000,
    currency: 'INR',
    deliverables: ['Event timeline', 'Vendor coordination', 'Day-of support'],
    status: 'active',
    rating: null,
    review: null,
    createdAt: '2026-09-06T09:00:00.000Z',
    completedAt: null,
    milestones: [
      {
        id: 'milestone-3-1',
        title: 'Planning & vendor booking',
        description: 'Finalize timeline and book catering, seating, and decor vendors.',
        amount: 12000,
        dueDate: '2026-09-20T00:00:00.000Z',
        status: 'paid',
      },
      {
        id: 'milestone-3-2',
        title: 'Day-of coordination',
        description: 'On-site setup, vendor coordination, and event-day support.',
        amount: 16000,
        dueDate: '2026-10-05T00:00:00.000Z',
        status: 'upcoming',
      },
    ],
  },
]
