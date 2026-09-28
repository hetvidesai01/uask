// A short, derived professional-role line built from data every profile
// already has (roles + primary category) — not a separate editable field.
// Shared by Profile, Discover People, global search, and Connections so
// "headline" reads consistently everywhere a person shows up.
export function getProfileHeadline(user) {
  const primaryCategory = user.categories?.[0]
  if (user.roles?.includes('provider')) {
    return primaryCategory ? `${primaryCategory} Provider` : 'Provider'
  }
  return 'Seeker'
}
