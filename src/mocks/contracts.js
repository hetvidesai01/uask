// One contract per already-accepted offer in mocks/offers.js.
//
// Contract status: draft -> awaiting_signatures -> active -> completed
// (or cancelled / disputed). It only becomes 'active' once BOTH parties have
// signed (demo e-acceptance, not a legal signature).
//
// Payments follow a demo 25–50–25 schedule, stored as three `milestones`
// (stage: 'initial' | 'progress' | 'final'). Stage status is a linear flow
// driven by explicit user actions:
//   upcoming/in_progress --[provider submits]--> submitted
//   submitted            --[client approves]-->  approved
//   approved             --[client marks paid, demo only]--> paid
// No real money moves anywhere. `rating` and `review` are set once, by the
// client, after completion.
//
// Fee percentages are demo placeholders, kept per-contract so a backend can
// supply real values later.
const DEMO_FEES = { clientPlatformFeePct: 2, freelancerCommissionPct: 8 }

function stages(id, price, dates, rows) {
  const initial = Math.round(price * 0.25)
  const progress = Math.round(price * 0.5)
  const meta = [
    ['initial', 'Initial Payment', 25, initial, 'Paid on contract confirmation.'],
    ['progress', 'Progress Payment', 50, progress, 'Due at ~60% of the work, once approved by the ASK Side.'],
    ['final', 'Final Payment', 25, price - initial - progress, 'Due once the final work is submitted and approved.'],
  ]
  return meta.map(([stage, title, percent, amount, description], i) => ({
    id: `milestone-${id}-${i + 1}`,
    stage,
    title,
    description,
    percent,
    amount,
    dueDate: dates[i],
    status: rows[i].status,
    paidAt: rows[i].paidAt ?? null,
  }))
}

const signed = (at) => ({ signed: true, signedAt: at })
const unsigned = { signed: false, signedAt: null }

export const contracts = [
  {
    id: 'contract-1',
    askId: 'ask-2',
    offerId: 'offer-3',
    seekerId: 'user-2',
    providerId: 'user-6',
    agreedPrice: 17600,
    currency: 'INR',
    scope: 'Rewrite the product landing page copy so it is punchier and clearer for a non-technical audience.',
    deliverables: ['Full page rewrite', 'Headline options', '1 revision round'],
    deadline: '2026-09-26T00:00:00.000Z',
    revisionsIncluded: 1,
    revisionsUsed: 0,
    status: 'active',
    signatures: { seeker: signed('2026-09-11T10:00:00.000Z'), provider: signed('2026-09-11T11:30:00.000Z') },
    progressPercent: 60,
    ownership: 'transfer_on_final_payment',
    portfolioPermission: 'ask_first',
    confidentiality: true,
    fees: DEMO_FEES,
    editCount: 1,
    editFeesTotal: 0,
    pendingChange: null,
    cancellationRequest: null,
    dispute: null,
    previousStatus: null,
    rating: null,
    review: null,
    createdAt: '2026-09-11T09:00:00.000Z',
    completedAt: null,
    milestones: stages(
      1,
      17600,
      ['2026-09-11T00:00:00.000Z', '2026-09-18T00:00:00.000Z', '2026-09-26T00:00:00.000Z'],
      [{ status: 'paid', paidAt: '2026-09-11T12:00:00.000Z' }, { status: 'submitted' }, { status: 'upcoming' }]
    ),
    history: [
      { id: 'h-1-1', actor: 'System', action: 'Contract generated from ASK and accepted response', at: '2026-09-11T09:00:00.000Z' },
      { id: 'h-1-2', actor: 'ASK Side', action: 'Changed deadline to Sep 26, 2026', at: '2026-09-11T09:40:00.000Z' },
      { id: 'h-1-3', actor: 'ASK Side', action: 'Signed the contract', at: '2026-09-11T10:00:00.000Z' },
      { id: 'h-1-4', actor: 'Respond Side', action: 'Signed the contract', at: '2026-09-11T11:30:00.000Z' },
      { id: 'h-1-5', actor: 'System', action: 'Contract active', at: '2026-09-11T11:30:00.000Z' },
      { id: 'h-1-6', actor: 'ASK Side', action: 'Marked Initial Payment as paid (demo)', at: '2026-09-11T12:00:00.000Z' },
      { id: 'h-1-7', actor: 'Respond Side', action: 'Submitted the 60% progress milestone', at: '2026-09-18T15:00:00.000Z' },
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
    scope: 'Product photography for 20 items with colour correction and web-optimised exports.',
    deliverables: ['Product photo shoot (20 items)', 'Photo editing & color correction', 'High-res + web-optimized exports'],
    deadline: '2026-09-08T00:00:00.000Z',
    revisionsIncluded: 2,
    revisionsUsed: 1,
    status: 'completed',
    signatures: { seeker: signed('2026-08-29T11:00:00.000Z'), provider: signed('2026-08-29T12:00:00.000Z') },
    progressPercent: 100,
    ownership: 'transfer_on_final_payment',
    portfolioPermission: 'allowed',
    confidentiality: true,
    fees: DEMO_FEES,
    editCount: 0,
    editFeesTotal: 0,
    pendingChange: null,
    cancellationRequest: null,
    dispute: null,
    previousStatus: null,
    rating: 4.9,
    review: "Noah's product shots elevated our whole storefront — quick turnaround and beautiful editing.",
    createdAt: '2026-08-29T10:00:00.000Z',
    completedAt: '2026-09-09T16:00:00.000Z',
    milestones: stages(
      2,
      36000,
      ['2026-08-29T00:00:00.000Z', '2026-09-02T00:00:00.000Z', '2026-09-08T00:00:00.000Z'],
      [
        { status: 'paid', paidAt: '2026-08-29T13:00:00.000Z' },
        { status: 'paid', paidAt: '2026-09-03T10:00:00.000Z' },
        { status: 'paid', paidAt: '2026-09-09T16:00:00.000Z' },
      ]
    ),
    history: [
      { id: 'h-2-1', actor: 'System', action: 'Contract generated from ASK and accepted response', at: '2026-08-29T10:00:00.000Z' },
      { id: 'h-2-2', actor: 'ASK Side', action: 'Signed the contract', at: '2026-08-29T11:00:00.000Z' },
      { id: 'h-2-3', actor: 'Respond Side', action: 'Signed the contract', at: '2026-08-29T12:00:00.000Z' },
      { id: 'h-2-4', actor: 'ASK Side', action: 'Marked Initial Payment as paid (demo)', at: '2026-08-29T13:00:00.000Z' },
      { id: 'h-2-5', actor: 'ASK Side', action: 'Approved the progress milestone', at: '2026-09-03T09:00:00.000Z' },
      { id: 'h-2-6', actor: 'ASK Side', action: 'Marked Progress Payment as paid (demo)', at: '2026-09-03T10:00:00.000Z' },
      { id: 'h-2-7', actor: 'ASK Side', action: 'Marked Final Payment as paid (demo)', at: '2026-09-09T16:00:00.000Z' },
      { id: 'h-2-8', actor: 'System', action: 'Contract completed', at: '2026-09-09T16:00:00.000Z' },
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
    scope: 'Plan and coordinate the event end to end: timeline, vendor booking and day-of support.',
    deliverables: ['Event timeline', 'Vendor coordination', 'Day-of support'],
    deadline: '2026-10-05T00:00:00.000Z',
    revisionsIncluded: 2,
    revisionsUsed: 0,
    status: 'awaiting_signatures',
    signatures: { seeker: signed('2026-09-06T10:00:00.000Z'), provider: unsigned },
    progressPercent: 0,
    ownership: 'transfer_on_final_payment',
    portfolioPermission: 'ask_first',
    confidentiality: false,
    fees: DEMO_FEES,
    editCount: 0,
    editFeesTotal: 0,
    pendingChange: null,
    cancellationRequest: null,
    dispute: null,
    previousStatus: null,
    rating: null,
    review: null,
    createdAt: '2026-09-06T09:00:00.000Z',
    completedAt: null,
    milestones: stages(
      3,
      28000,
      ['2026-09-06T00:00:00.000Z', '2026-09-20T00:00:00.000Z', '2026-10-05T00:00:00.000Z'],
      [{ status: 'upcoming' }, { status: 'upcoming' }, { status: 'upcoming' }]
    ),
    history: [
      { id: 'h-3-1', actor: 'System', action: 'Contract generated from ASK and accepted response', at: '2026-09-06T09:00:00.000Z' },
      { id: 'h-3-2', actor: 'ASK Side', action: 'Signed the contract', at: '2026-09-06T10:00:00.000Z' },
    ],
  },
]
