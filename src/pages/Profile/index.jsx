import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../../components/ui/Avatar'
import Card from '../../components/ui/Card'
import Tag from '../../components/ui/Tag'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import ReputationMetrics from './ReputationMetrics'
import ReviewsSection from './ReviewsSection'
import CompletedWorkSection from './CompletedWorkSection'
import PortfolioSection from './PortfolioSection'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { getUserById } from '../../services/authService'
import { getAskById, getCategories } from '../../services/askService'
import { getThreads } from '../../services/messageService'
import { getCompletedContractsForProvider, getProviderReputation } from '../../services/contractService'
import { getPortfolioForUser } from '../../services/profileService'
import { isRequired } from '../../utils/validators'
import { formatAbsoluteDate } from '../../utils/formatDate'
import styles from './Profile.module.css'

const ROLE_LABELS = { seeker: 'Seeker', provider: 'Provider' }

// Derived, read-only "headline" — no new editable field on the user model
// for this phase, just a short professional-role line built from data the
// profile already has (roles + primary category).
function getHeadline(profileUser) {
  const primaryCategory = profileUser.categories?.[0]
  if (profileUser.roles.includes('provider')) {
    return primaryCategory ? `${primaryCategory} Provider` : 'Provider'
  }
  return 'Seeker'
}

// Joins a raw completed contract with its ask/client details for the
// Completed Work and Reviews sections (reviews are just the subset with a
// non-null rating — see the `reviews` derivation in the component below).
function toCompletedWorkItem(contract, asksById, clientsById) {
  const ask = asksById[contract.askId]
  const client = clientsById[contract.seekerId]

  return {
    id: contract.id,
    askId: contract.askId,
    askTitle: ask?.title ?? 'View ASK',
    askCategory: ask?.category,
    clientName: client?.name ?? 'Unknown client',
    agreedPrice: contract.agreedPrice,
    currency: contract.currency,
    completedAt: contract.completedAt,
    paidMilestoneCount: contract.milestones.filter((m) => m.status === 'paid').length,
    totalMilestoneCount: contract.milestones.length,
    rating: contract.rating,
    text: contract.review,
  }
}

export default function Profile() {
  const { userId } = useParams()
  const { user: currentUser, updateProfile } = useAuth()
  const { showToast } = useToast()

  const targetId = userId ?? currentUser.id
  const isOwnProfile = targetId === currentUser.id

  const [status, setStatus] = useState('loading')
  const [profileUser, setProfileUser] = useState(null)
  const [reputation, setReputation] = useState(null)
  const [completedWork, setCompletedWork] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [messageThreadId, setMessageThreadId] = useState(null)
  const [categoryOptions, setCategoryOptions] = useState([])

  const [editing, setEditing] = useState(false)
  const [editValues, setEditValues] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCategories().then((list) => setCategoryOptions(list.map((category) => category.label)))
  }, [])

  const load = useCallback(async () => {
    setEditing(false)
    setEditValues(null)
    setStatus('loading')
    try {
      const found = await getUserById(targetId)
      if (!found) {
        setStatus('not_found')
        return
      }

      const tasks = []

      if (found.roles.includes('provider')) {
        tasks.push(
          Promise.all([
            getProviderReputation(found.id),
            getCompletedContractsForProvider(found.id),
            getPortfolioForUser(found.id),
          ]).then(async ([reputationResult, completedContracts, portfolioItems]) => {
            const askIds = [...new Set(completedContracts.map((contract) => contract.askId))]
            const clientIds = [...new Set(completedContracts.map((contract) => contract.seekerId))]

            const [asks, clients] = await Promise.all([
              Promise.all(askIds.map((id) => getAskById(id))),
              Promise.all(clientIds.map((id) => getUserById(id))),
            ])
            const asksById = Object.fromEntries(asks.filter(Boolean).map((ask) => [ask.id, ask]))
            const clientsById = Object.fromEntries(clients.filter(Boolean).map((client) => [client.id, client]))

            setReputation(reputationResult)
            setCompletedWork(completedContracts.map((contract) => toCompletedWorkItem(contract, asksById, clientsById)))
            setPortfolio(portfolioItems)
          })
        )
      } else {
        setReputation(null)
        setCompletedWork([])
        setPortfolio([])
      }

      if (found.id !== currentUser.id) {
        tasks.push(
          getThreads(currentUser.id).then((threads) => {
            const shared = threads.find((thread) => thread.participantIds.includes(found.id))
            setMessageThreadId(shared ? shared.id : null)
          })
        )
      } else {
        setMessageThreadId(null)
      }

      await Promise.all(tasks)

      setProfileUser(found)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }, [targetId, currentUser.id])

  useEffect(() => {
    load()
  }, [load])

  function startEditing() {
    setErrors({})
    setEditValues({
      name: profileUser.name,
      bio: profileUser.bio,
      location: profileUser.location,
      categories: [...profileUser.categories],
      avatarUrl: profileUser.avatarUrl,
    })
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setEditValues(null)
    setErrors({})
  }

  function updateField(field, value) {
    setEditValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function addCategory(label) {
    if (!label || editValues.categories.includes(label)) return
    setEditValues((current) => ({ ...current, categories: [...current.categories, label] }))
  }

  function removeCategory(label) {
    setEditValues((current) => ({
      ...current,
      categories: current.categories.filter((category) => category !== label),
    }))
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!editValues) return

    if (!isRequired(editValues.name)) {
      setErrors({ name: 'Enter your name.' })
      return
    }

    setSaving(true)
    try {
      const updated = await updateProfile({
        name: editValues.name.trim(),
        bio: editValues.bio.trim(),
        location: editValues.location.trim(),
        categories: editValues.categories,
        avatarUrl: editValues.avatarUrl.trim(),
      })
      setProfileUser(updated)
      setEditing(false)
      setEditValues(null)
      showToast('Profile updated.')
    } catch {
      showToast('Something went wrong saving your profile. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className={styles.centered}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={styles.centered}>
        <EmptyState
          icon="⚠️"
          title="Couldn't load this profile"
          message="Something went wrong loading this profile. Please try again."
          action={
            <Button variant="secondary" onClick={load}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  if (status === 'not_found') {
    return (
      <div className={styles.centered}>
        <EmptyState
          icon="🚫"
          title="Profile not found"
          message="This user may not exist, or the link is incorrect."
          action={
            <Button as={Link} to="/app/dashboard" variant="secondary">
              Back to dashboard
            </Button>
          }
        />
      </div>
    )
  }

  const availableCategoryOptions = editValues
    ? categoryOptions
        .filter((category) => !editValues.categories.includes(category))
        .map((category) => ({ value: category, label: category }))
    : []

  const Wrapper = isOwnProfile ? 'form' : 'div'
  const wrapperProps = isOwnProfile ? { onSubmit: handleSave } : {}

  // Contract-computed reputation takes priority once it exists; otherwise
  // fall back to the profile's seeded baseline rating so this stays
  // consistent with how the same person's rating shows up elsewhere in the
  // app (UserMiniCard, Compare Responses) even before they have completed
  // contracts in this mock dataset.
  const averageRating = reputation?.averageRating ?? profileUser.rating
  const reviewCount = reputation?.reviewCount ? reputation.reviewCount : profileUser.reviewCount
  const reviews = completedWork.filter((item) => item.rating != null)
  const isProvider = profileUser.roles.includes('provider')

  return (
    <div className={styles.page}>
      <Wrapper className={styles.form} {...wrapperProps}>
        <Card padding="lg" className={styles.header}>
          <div className={styles.headerTop}>
            <Avatar
              src={editing ? editValues.avatarUrl : profileUser.avatarUrl}
              name={editing ? editValues.name : profileUser.name}
              size="lg"
            />

            <div className={styles.headerInfo}>
              {editing ? (
                <Input
                  label="Name"
                  value={editValues.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  error={errors.name}
                  className={styles.nameField}
                />
              ) : (
                <h1 className={styles.name}>{profileUser.name}</h1>
              )}

              {!editing && <p className={styles.headline}>{getHeadline(profileUser)}</p>}

              <div className={styles.roles}>
                {profileUser.roles.map((role) => (
                  <span key={role} className={[styles.roleBadge, styles[role]].join(' ')}>
                    {ROLE_LABELS[role] ?? role}
                  </span>
                ))}
              </div>

              {editing ? (
                <Input
                  label="Location"
                  value={editValues.location}
                  onChange={(event) => updateField('location', event.target.value)}
                  placeholder="City, State or Remote"
                  className={styles.locationField}
                />
              ) : (
                <>
                  <div className={styles.ratingSummary}>
                    <span className={styles.ratingValue}>
                      {averageRating != null ? `${averageRating.toFixed(1)} / 5` : '— / 5'}
                    </span>
                    <span className={styles.ratingCount}>
                      {reviewCount > 0 ? `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}
                    </span>
                  </div>

                  <div className={styles.metaRow}>
                    {profileUser.location && <span>{profileUser.location}</span>}
                    <span className={styles.muted}>Member since {formatAbsoluteDate(profileUser.joinedAt)}</span>
                  </div>
                </>
              )}

              {editing && (
                <Input
                  label="Avatar URL"
                  hint="Paste an image link, or leave blank to use initials."
                  value={editValues.avatarUrl}
                  onChange={(event) => updateField('avatarUrl', event.target.value)}
                  placeholder="https://…"
                  className={styles.avatarField}
                />
              )}
            </div>

            <div className={styles.headerActions}>
              {isOwnProfile ? (
                editing ? (
                  <>
                    <Button type="button" variant="ghost" size="sm" onClick={cancelEditing} disabled={saving}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" loading={saving}>
                      Save changes
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="secondary" size="sm" onClick={startEditing}>
                    Edit profile
                  </Button>
                )
              ) : (
                messageThreadId && (
                  <Button as={Link} to={`/app/inbox/messages/${messageThreadId}`} size="sm">
                    Message
                  </Button>
                )
              )}
            </div>
          </div>
        </Card>

        <Card padding="lg" className={styles.section}>
          <h2 className={styles.sectionTitle}>About</h2>
          {editing ? (
            <Textarea
              label="Bio"
              maxLength={280}
              value={editValues.bio}
              onChange={(event) => updateField('bio', event.target.value)}
              placeholder="Tell people a bit about yourself or your work."
            />
          ) : (
            <p className={styles.bio}>{profileUser.bio || 'No bio added yet.'}</p>
          )}
        </Card>

        <Card padding="lg" className={styles.section}>
          <h2 className={styles.sectionTitle}>Skills &amp; categories</h2>

          {editing ? (
            <div className={styles.editCategories}>
              <div className={styles.tagRow}>
                {editValues.categories.map((category) => (
                  <Tag key={category} onRemove={() => removeCategory(category)}>
                    {category}
                  </Tag>
                ))}
              </div>
              {availableCategoryOptions.length > 0 && (
                <Select
                  label="Add a skill or category"
                  value=""
                  onChange={(event) => addCategory(event.target.value)}
                  options={[{ value: '', label: 'Choose a category…' }, ...availableCategoryOptions]}
                  className={styles.categorySelect}
                />
              )}
            </div>
          ) : profileUser.categories.length > 0 ? (
            <div className={styles.tagRow}>
              {profileUser.categories.map((category) => (
                <Tag key={category}>{category}</Tag>
              ))}
            </div>
          ) : (
            <p className={styles.muted}>No skills added yet.</p>
          )}
        </Card>
      </Wrapper>

      {isProvider && reputation && (
        <>
          <Card padding="lg" className={styles.section}>
            <h2 className={styles.sectionTitle}>Reputation</h2>
            <ReputationMetrics
              averageRating={averageRating}
              reviewCount={reviewCount}
              completedContractCount={reputation.completedContractCount}
              revenue={reputation.revenue}
              profileBoosterPct={reputation.profileBoosterPct}
            />
          </Card>

          <Card padding="lg" className={styles.section}>
            <h2 className={styles.sectionTitle}>Reviews</h2>
            {reviews.length > 0 ? (
              <ReviewsSection reviews={reviews} />
            ) : (
              <p className={styles.muted}>No reviews yet.</p>
            )}
          </Card>

          <Card padding="lg" className={styles.section}>
            <h2 className={styles.sectionTitle}>Completed work</h2>
            {completedWork.length > 0 ? (
              <CompletedWorkSection items={completedWork} />
            ) : (
              <p className={styles.muted}>No completed contracts yet.</p>
            )}
          </Card>

          <Card padding="lg" className={styles.section}>
            <h2 className={styles.sectionTitle}>Portfolio</h2>
            {portfolio.length > 0 ? (
              <PortfolioSection items={portfolio} />
            ) : (
              <EmptyState
                icon="🖼️"
                title="No portfolio items yet"
                message={
                  isOwnProfile
                    ? "Add a few samples of your work so clients can see what you do before they hire you."
                    : `${profileUser.name.split(' ')[0]} hasn't added any portfolio items yet.`
                }
              />
            )}
          </Card>
        </>
      )}
    </div>
  )
}
