// Mock-only "AI Ask Assistant" — deterministic heuristics over the current
// draft, no real model call. Kept behind the same async/delay shape every
// other service uses so a real endpoint can replace this later without
// touching the component that calls it.
const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms))

const CATEGORY_KEYWORDS = {
  Design: ['logo', 'brand', 'design', 'illustration', 'graphic', 'packaging', 'icon'],
  Writing: ['write', 'copy', 'content', 'blog', 'article', 'edit', 'proofread', 'rewrite'],
  Development: ['website', 'app', 'bug', 'code', 'developer', 'api', 'fix', 'build', 'plugin'],
  Photography: ['photo', 'shoot', 'photography', 'portrait', 'video', 'headshot'],
  Marketing: ['marketing', 'ads', 'campaign', 'seo', 'social media', 'email'],
  Tutoring: ['tutor', 'lesson', 'teach', 'learn', 'coaching', 'study'],
  Events: ['event', 'party', 'wedding', 'planning', 'venue'],
}

const CATEGORY_BUDGET_DEFAULTS = {
  Design: { min: 250, max: 600, days: 10 },
  Writing: { min: 100, max: 300, days: 7 },
  Development: { min: 400, max: 1200, days: 14 },
  Photography: { min: 200, max: 500, days: 7 },
  Marketing: { min: 300, max: 800, days: 14 },
  Tutoring: { min: 50, max: 150, days: 5 },
  Events: { min: 300, max: 900, days: 21 },
}
const DEFAULT_BUDGET = { min: 150, max: 500, days: 10 }

function guessCategory(text) {
  const lower = text.toLowerCase()
  let best = null
  let bestScore = 0
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = words.filter((word) => lower.includes(word)).length
    if (score > bestScore) {
      bestScore = score
      best = category
    }
  }
  return best
}

function buildTitleSuggestion(values) {
  const base = values.title.trim()
  const category = values.category || guessCategory(`${values.title} ${values.description}`)
  if (category && !base.toLowerCase().includes(category.toLowerCase())) {
    return `${base} — ${category.toLowerCase()} project, ready to start`
  }
  return `${base}, ready to start this week`
}

function buildDescriptionSuggestion(values) {
  const base = values.description.trim()
  const closing =
    'Please share your relevant experience, your availability, and any questions in your response.'
  return base ? `${base}\n\n${closing}` : `Describe what you need done, your goals, and any must-haves.\n\n${closing}`
}

function buildBudgetTimelineSuggestion(values) {
  const defaults = CATEGORY_BUDGET_DEFAULTS[values.category] ?? DEFAULT_BUDGET
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + defaults.days)

  return {
    budgetMin: values.budgetMin || String(defaults.min),
    budgetMax: values.budgetMax || String(defaults.max),
    deadline: values.deadline || deadline.toISOString().slice(0, 10),
  }
}

// Returns a list of { id, field, label, description, value } suggestions —
// only for things that look genuinely improvable, so an already-strong
// draft returns fewer (or no) suggestions rather than busywork.
export async function getSuggestions(values) {
  await delay(500)

  const suggestions = []
  const text = `${values.title} ${values.description}`.trim()

  if (values.title?.trim() && values.title.trim().length < 40) {
    suggestions.push({
      id: 'title',
      field: 'title',
      label: 'Stronger title',
      description: 'A clearer, more specific title tends to get more responses.',
      value: buildTitleSuggestion(values),
    })
  }

  if (values.description?.trim() && values.description.trim().length < 220) {
    suggestions.push({
      id: 'description',
      field: 'description',
      label: 'More detailed description',
      description: 'Adding a bit more context helps providers scope their offer accurately.',
      value: buildDescriptionSuggestion(values),
    })
  }

  const suggestedCategory = guessCategory(text)
  if (suggestedCategory && suggestedCategory !== values.category) {
    suggestions.push({
      id: 'category',
      field: 'category',
      label: 'Category match',
      description: `Based on your title and description, "${suggestedCategory}" looks like the best fit.`,
      value: suggestedCategory,
    })
  }

  if (!values.budgetMin || !values.budgetMax || !values.deadline) {
    suggestions.push({
      id: 'budgetTimeline',
      field: 'budgetTimeline',
      label: 'Suggested budget & timeline',
      description: 'A typical range and turnaround for this kind of ASK, based on similar requests.',
      value: buildBudgetTimelineSuggestion(values),
    })
  }

  return suggestions
}

// A simple 0-100 completeness score — not a real quality model, just a
// transparent checklist so the number always matches what's visibly filled
// in. Recompute whenever the draft changes.
export async function getAskStrength(values) {
  await delay(250)

  let score = 0
  if (values.title?.trim().length >= 10) score += 15
  if (values.title?.trim().length >= 30) score += 10
  if (values.category) score += 15
  if (values.description?.trim().length >= 40) score += 15
  if (values.description?.trim().length >= 150) score += 10
  if (values.budgetMin && values.budgetMax) score += 15
  if (values.deadline) score += 10
  if (values.location?.trim()) score += 5
  if (values.isRemote !== '') score += 5

  return Math.min(100, score)
}
