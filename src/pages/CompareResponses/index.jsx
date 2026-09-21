import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import UserMiniCard from '../../components/ask/UserMiniCard'
import OfferCard from '../../components/offer/OfferCard'
import OfferStatusBadge from '../../components/offer/OfferStatusBadge'
import Tag from '../../components/ui/Tag'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { getAskById, updateAskStatus } from '../../services/askService'
import { getOffersForAsk, updateOfferStatus } from '../../services/offerService'
import { getUserById } from '../../services/authService'
import { formatCurrency } from '../../utils/formatCurrency'
import styles from './CompareResponses.module.css'

const MAX_COMPARE = 4

function splitPitch(pitch) {
  const expMarker = '\n\nRelevant experience:'
  const portfolioMarker = '\n\nPortfolio:'
  const expIndex = pitch.indexOf(expMarker)
  if (expIndex === -1) return { mainPitch: pitch, experience: null }

  const mainPitch = pitch.slice(0, expIndex).trim()
  const afterExp = pitch.slice(expIndex + expMarker.length)
  const portfolioIndex = afterExp.indexOf(portfolioMarker)
  const experience = (portfolioIndex === -1 ? afterExp : afterExp.slice(0, portfolioIndex)).trim()

  return { mainPitch, experience: experience || null }
}

export default function CompareResponses() {
  const { askId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [status, setStatus] = useState('loading')
  const [ask, setAsk] = useState(null)
  const [offers, setOffers] = useState([])
  const [providersById, setProvidersById] = useState({})
  const [selectedIds, setSelectedIds] = useState([])
  const [actioningId, setActioningId] = useState(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const foundAsk = await getAskById(askId)
      if (!foundAsk) {
        setStatus('not_found')
        return
      }

      if (foundAsk.requesterId !== user.id) {
        setStatus('unauthorized')
        return
      }

      const foundOffers = await getOffersForAsk(askId)
      foundOffers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      const providerIds = [...new Set(foundOffers.map((offer) => offer.providerId))]
      const providers = await Promise.all(providerIds.map((id) => getUserById(id)))
      const providerMap = Object.fromEntries(
        providers.filter(Boolean).map((provider) => [provider.id, provider])
      )

      setAsk(foundAsk)
      setOffers(foundOffers)
      setProvidersById(providerMap)
      setSelectedIds(foundOffers.slice(0, MAX_COMPARE).map((offer) => offer.id))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [askId, user.id])

  useEffect(() => {
    load()
  }, [load])

  function toggleSelect(offerId) {
    setSelectedIds((current) => {
      if (current.includes(offerId)) return current.filter((id) => id !== offerId)
      if (current.length >= MAX_COMPARE) return current
      return [...current, offerId]
    })
  }

  const anyAccepted = offers.some((offer) => offer.status === 'accepted')

  function getActionState(offer) {
    const isAccepted = offer.status === 'accepted'
    const isRejected = offer.status === 'rejected'
    const isShortlisted = offer.status === 'shortlisted'
    return {
      isAccepted,
      shortlistDisabled: isRejected || isShortlisted || anyAccepted,
      acceptDisabled: isRejected || anyAccepted,
    }
  }

  async function handleShortlist(offer) {
    setActioningId(offer.id)
    try {
      const updated = await updateOfferStatus(offer.id, 'shortlisted')
      if (updated) {
        setOffers((current) => current.map((item) => (item.id === updated.id ? updated : item)))
        showToast('Offer shortlisted.')
      }
    } finally {
      setActioningId(null)
    }
  }

  async function handleAccept(offer) {
    setActioningId(offer.id)
    try {
      const updated = await updateOfferStatus(offer.id, 'accepted')
      if (updated) {
        setOffers((current) => current.map((item) => (item.id === updated.id ? updated : item)))
        const updatedAsk = await updateAskStatus(askId, 'accepted')
        if (updatedAsk) setAsk(updatedAsk)
        showToast('Offer accepted.')
      }
    } finally {
      setActioningId(null)
    }
  }

  function handleMessage() {
    navigate('/app/messages')
  }

  function renderActions(offer) {
    const { isAccepted, shortlistDisabled, acceptDisabled } = getActionState(offer)
    const busy = actioningId === offer.id

    return (
      <>
        <Button
          size="sm"
          variant="secondary"
          disabled={shortlistDisabled}
          loading={busy}
          onClick={() => handleShortlist(offer)}
        >
          {offer.status === 'shortlisted' ? 'Shortlisted' : 'Shortlist'}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleMessage}>
          Message
        </Button>
        <Button
          size="sm"
          variant={isAccepted ? 'secondary' : 'primary'}
          disabled={acceptDisabled}
          loading={busy}
          onClick={() => handleAccept(offer)}
        >
          {isAccepted ? 'Accepted ✓' : 'Accept'}
        </Button>
      </>
    )
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
          title="Couldn't load responses"
          message="Something went wrong. Please try again."
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
          title="ASK not found"
          message="This ASK may have been removed, or the link is incorrect."
          action={
            <Button as={Link} to="/app/discover" variant="secondary">
              Back to Discover
            </Button>
          }
        />
      </div>
    )
  }

  if (status === 'unauthorized') {
    return (
      <div className={styles.centered}>
        <EmptyState
          icon="🔒"
          title="You don't have access to this page"
          message="Only the person who posted this ASK can compare its responses."
          action={
            <Button as={Link} to={`/app/asks/${askId}`} variant="secondary">
              Back to ASK
            </Button>
          }
        />
      </div>
    )
  }

  if (offers.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Compare responses</h1>
          <p className={styles.subtitle}>{ask.title}</p>
        </div>
        <EmptyState
          icon="📭"
          title="No responses yet"
          message="Once providers respond to this ASK, you'll be able to compare them here."
          action={
            <Button as={Link} to={`/app/asks/${askId}`} variant="secondary">
              Back to ASK
            </Button>
          }
        />
      </div>
    )
  }

  const selectedOffers = offers.filter((offer) => selectedIds.includes(offer.id))

  const rows = [
    {
      label: 'Rating',
      render: (offer) => {
        const provider = providersById[offer.providerId]
        return provider?.rating != null ? `★ ${provider.rating.toFixed(1)} (${provider.reviewCount})` : '—'
      },
    },
    { label: 'Price', render: (offer) => formatCurrency(offer.price, offer.currency) },
    { label: 'Delivery', render: (offer) => `${offer.deliveryDays}-day delivery` },
    {
      label: 'Pitch',
      render: (offer) => <p className={styles.cellText}>{splitPitch(offer.pitch).mainPitch}</p>,
    },
    {
      label: "What's included",
      render: (offer) => (
        <div className={styles.chips}>
          {offer.deliverables.map((item) => (
            <Tag key={item}>{item}</Tag>
          ))}
        </div>
      ),
    },
    {
      label: 'Experience',
      render: (offer) => splitPitch(offer.pitch).experience || 'Not provided',
    },
    { label: 'Availability', render: () => 'Not specified' },
    { label: 'Status', render: (offer) => <OfferStatusBadge status={offer.status} /> },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Compare responses</h1>
        <p className={styles.subtitle}>{ask.title}</p>
      </div>

      {offers.length > MAX_COMPARE && (
        <div className={styles.picker}>
          <p className={styles.pickerLabel}>
            Comparing {selectedIds.length} of {offers.length} responses — choose up to {MAX_COMPARE}:
          </p>
          <div className={styles.pickerChips}>
            {offers.map((offer) => {
              const provider = providersById[offer.providerId]
              const isSelected = selectedIds.includes(offer.id)
              const disablePick = !isSelected && selectedIds.length >= MAX_COMPARE

              return (
                <button
                  key={offer.id}
                  type="button"
                  className={[styles.pickerChip, isSelected ? styles.pickerChipSelected : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={isSelected}
                  disabled={disablePick}
                  onClick={() => toggleSelect(offer.id)}
                >
                  {provider?.name || 'Provider'} · {formatCurrency(offer.price, offer.currency)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className={styles.desktopWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.rowLabelHeader}>
                <span className="sr-only">Criteria</span>
              </th>
              {selectedOffers.map((offer) => (
                <th scope="col" key={offer.id}>
                  <UserMiniCard user={providersById[offer.providerId]} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className={styles.rowLabel}>
                  {row.label}
                </th>
                {selectedOffers.map((offer) => (
                  <td key={offer.id}>{row.render(offer)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className={styles.rowLabel}>
                Actions
              </th>
              {selectedOffers.map((offer) => (
                <td key={offer.id}>
                  <div className={styles.actionButtons}>{renderActions(offer)}</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.mobileList}>
        {selectedOffers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            provider={providersById[offer.providerId]}
            actions={renderActions(offer)}
          />
        ))}
      </div>
    </div>
  )
}
