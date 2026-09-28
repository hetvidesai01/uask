import { subscriptions } from '../mocks/subscriptions'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

// Upgrades made during a session are persisted here so they survive a
// reload, without mutating the seeded mock array in place (mirrors the
// read/write split every other service keeps between mocks/ and runtime
// state). Swap this whole module for a real API call in Phase 10 — the
// function signatures below are what callers already depend on.
const STORAGE_KEY = 'uask.subscriptions'

function readOverrides() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function writeOverride(userId, record) {
  const overrides = readOverrides()
  overrides[userId] = record
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    // Storage unavailable — the record still lives in this session's state.
  }
}

function basicRecord(userId) {
  return { userId, plan: 'basic', billingCycle: null, upgradedAt: null }
}

export async function getSubscription(userId) {
  await delay(150)

  const overrides = readOverrides()
  if (overrides[userId]) return overrides[userId]

  const seeded = subscriptions.find((item) => item.userId === userId)
  return seeded ?? basicRecord(userId)
}

// Mock upgrade only — no payment gateway. billingCycle is 'monthly' | 'yearly'.
// Not called from the Premium drawer's checkout flow anymore (see
// createCheckoutSession below) — kept as the function a real backend would
// call to finalize a subscription once a payment actually succeeds.
export async function upgradeToPremium(userId, billingCycle = 'monthly') {
  await delay(700)

  const record = {
    userId,
    plan: 'premium',
    billingCycle,
    upgradedAt: new Date().toISOString(),
  }
  writeOverride(userId, record)
  return record
}

const PRICE_BY_CYCLE = { monthly: 149, yearly: 999 }

// Stands in for a real "create checkout session" backend call (e.g.
// POST /api/checkout). It deliberately does NOT touch subscription state —
// no payment gateway is wired up yet, so the frontend must not grant
// Premium on its own. When a real backend endpoint exists, swap this
// function's body for the actual request; callers (PremiumDrawer) already
// call it with the same (userId, billingCycle) signature and only care
// about the returned session shape.
export async function createCheckoutSession(userId, billingCycle = 'monthly') {
  await delay(600)

  return {
    id: `mock-checkout-${userId}-${Date.now()}`,
    userId,
    plan: 'premium',
    billingCycle,
    amount: PRICE_BY_CYCLE[billingCycle] ?? PRICE_BY_CYCLE.monthly,
    currency: 'INR',
    status: 'requires_backend', // no real payment gateway integrated yet
    createdAt: new Date().toISOString(),
  }
}
