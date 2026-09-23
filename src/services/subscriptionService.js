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
