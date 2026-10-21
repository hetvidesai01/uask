import { ApiError, http } from './http'
import { findMockUserById } from './mockUserStore'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Backend ids are UUIDv4. Anything else is a seeded mock-era id (user-1 …)
// still referenced by not-yet-integrated data (asks, threads, contracts).
export function isBackendId(id) {
  return UUID_PATTERN.test(String(id ?? ''))
}

// The backend sends null for unset optional fields; the UI renders empty
// strings (same rule as authService.normalizeUser for auth responses).
function normalizeProfile(profile) {
  if (!profile) return null
  return {
    ...profile,
    avatarUrl: profile.avatarUrl ?? '',
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    categories: profile.categories ?? [],
  }
}

// GET /users/{id} — public profile: id, name, avatarUrl, bio, location,
// categories, roles, rating, reviewCount, joinedAt. Deliberately NO email and
// no linkedin/instagram/contactEmail (contact privacy lives behind
// profileService.getContactDetails → GET /users/{id}/contact).
// 404 → null so pages can show their "not found" state.
export async function getUserById(id) {
  if (!isBackendId(id)) {
    // TEMPORARY mock-era fallback — see mockUserStore.js.
    return findMockUserById(id)
  }
  try {
    return normalizeProfile(await http.get(`/users/${id}`))
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

// PATCH /users/{id} — owner only (the backend enforces that). Editable:
// name, bio, location, avatarUrl, categories, linkedin, instagram,
// contactEmail. Ratings/review counts are derived server-side and are never
// sent. Empty strings on nullable fields become null — the backend rejects
// blank social/contact values and treats null as "clear".
export async function updateProfile(userId, data) {
  const payload = {
    name: data.name?.trim(),
    bio: data.bio?.trim() || null,
    location: data.location?.trim() || null,
    avatarUrl: data.avatarUrl?.trim() || null,
    categories: data.categories ?? [],
    linkedin: data.linkedin?.trim() || null,
    instagram: data.instagram?.trim() || null,
    contactEmail: data.contactEmail?.trim() || null,
  }
  return normalizeProfile(await http.patch(`/users/${userId}`, payload))
}
