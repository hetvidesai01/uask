import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Reveal, RevealGroup } from '../../components/ui/Reveal'
import { SNAPPY_SPRING } from '../../utils/motion'
import UserMiniCard from '../../components/ask/UserMiniCard'
import OfferCard from '../../components/offer/OfferCard'
import OfferStatusBadge from '../../components/offer/OfferStatusBadge'
import MatchBadge from '../../components/matching/MatchBadge'
import WhyThisMatch from '../../components/matching/WhyThisMatch'
import Tag from '../../components/ui/Tag'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { getAskById, updateAskStatus } from '../../services/askService'
import { getOffersForAsk, updateOfferStatus } from '../../services/offerService'
import { getUserById } from '../../services/authService'
import { createContract } from '../../services/contractService'
import { rankResponses } from '../../services/matchingService'
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
  // The primary matching intelligence for this prototype: responses to
  // THIS ask, ranked by fit — see services/matchingService.js. Sorted by
  // score descending, so "ranked by default" falls out of load order.
  const [rankedResults, setRankedResults] = useState([])
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
      const providerIds = [...new Set(foundOffers.map((offer) => offer.providerId))]
      const providers = await Promise.all(providerIds.map((id) => getUserById(id)))

      const results = await rankResponses(foundAsk, foundOffers, providers)

      setAsk(foundAsk)
      setRankedResults(results)
      // Ranked by match score by default — the seeker can still change
      // which ones are selected below (see toggleSelect).
      setSelectedIds(results.slice(0, MAX_COMPARE).map((result) => result.offer.id))
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

  function updateOfferInResults(updatedOffer) {
    setRankedResults((current) =>
      current.map((result) => (result.offer.id === updatedOffer.id ? { ...result, offer: updatedOffer } : result))
    )
  }

  const anyAccepted = rankedResults.some((result) => result.offer.status === 'accepted')

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
        updateOfferInResults(updated)
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
        updateOfferInResults(updated)
        const updatedAsk = await updateAskStatus(askId, 'accepted')
        if (updatedAsk) setAsk(updatedAsk)
        // Frontend/mock state transition only — creates the contract record
        // so the Contract page is populated immediately, no real payment
        // processing happens here.
        await createContract({
          askId,
          offerId: updated.id,
          seekerId: user.id,
          providerId: updated.providerId,
          agreedPrice: updated.price,
          currency: updated.currency,
          deliverables: updated.deliverables,
          deliveryDays: updated.deliveryDays,
        })
        showToast('Offer accepted — contract started.')
        navigate(`/app/asks/${askId}/contract`)
      }
    } finally {
      setActioningId(null)
    }
  }

  function handleMessage() {
    navigate('/app/inbox')
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
          {isAccepted ? 'Accepted ✓' : 'Accept & Start'}
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

  if (rankedResults.length === 0) {
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

  const selectedResults = rankedResults.filter((result) => selectedIds.includes(result.offer.id))
  // rankedResults is sorted best-first, so the first entry is the top match.
  const topOfferId = rankedResults[0]?.offer.id
  // Columns fade/settle in when a response is selected; keyed by offer id so
  // existing columns don't re-animate.
  const cellIn = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: SNAPPY_SPRING,
  }

  const bestPrice =
    selectedResults.length > 1 ? Math.min(...selectedResults.map((result) => result.offer.price)) : null
  const bestDelivery =
    selectedResults.length > 1 ? Math.min(...selectedResults.map((result) => result.offer.deliveryDays)) : null

  const rows = [
    {
      label: 'Rating',
      render: (result) => {
        const provider = result.provider
        return provider?.rating != null ? `★ ${provider.rating.toFixed(1)} (${provider.reviewCount})` : '—'
      },
    },
    {
      label: 'Match Score',
      render: (result) => (
        <div className={styles.matchCell}>
          <MatchBadge score={result.score} label={result.label} size="sm" />
          {result.strength && <span className={styles.summaryTag}>{result.strength}</span>}
          <WhyThisMatch reasons={result.reasons} />
        </div>
      ),
    },
    {
      label: 'Price',
      render: (result) => (
        <span className={result.offer.price === bestPrice ? styles.bestValue : undefined}>
          {formatCurrency(result.offer.price, result.offer.currency)}
        </span>
      ),
    },
    {
      label: 'Delivery',
      render: (result) => (
        <span className={result.offer.deliveryDays === bestDelivery ? styles.bestValue : undefined}>
          {result.offer.deliveryDays}-day delivery
        </span>
      ),
    },
    {
      label: 'Pitch',
      render: (result) => <p className={styles.cellText}>{splitPitch(result.offer.pitch).mainPitch}</p>,
    },
    {
      label: "What's included",
      render: (result) => (
        <div className={styles.chips}>
          {result.offer.deliverables.map((item) => (
            <Tag key={item}>{item}</Tag>
          ))}
        </div>
      ),
    },
    {
      label: 'Experience',
      render: (result) => splitPitch(result.offer.pitch).experience || 'Not provided',
    },
    { label: 'Availability', render: () => 'Not specified' },
    { label: 'Status', render: (result) => <OfferStatusBadge status={result.offer.status} /> },
  ]

  return (
    <RevealGroup className={styles.page}>
      <Reveal className={styles.header}>
        <h1 className={styles.title}>Compare responses</h1>
        <p className={styles.subtitle}>
          {ask.title} — ranked by match score. This is a starting point, not a decision made for you.
        </p>
      </Reveal>

      {rankedResults.length > MAX_COMPARE && (
        <Reveal className={styles.picker}>
          <p className={styles.pickerLabel}>
            Comparing {selectedIds.length} of {rankedResults.length} responses — choose up to {MAX_COMPARE}:
          </p>
          <div className={styles.pickerChips}>
            {rankedResults.map((result) => {
              const isSelected = selectedIds.includes(result.offer.id)
              const disablePick = !isSelected && selectedIds.length >= MAX_COMPARE

              return (
                <motion.button
                  key={result.offer.id}
                  type="button"
                  className={[styles.pickerChip, isSelected ? styles.pickerChipSelected : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={isSelected}
                  disabled={disablePick}
                  onClick={() => toggleSelect(result.offer.id)}
                  animate={{ scale: isSelected ? 1.03 : 1 }}
                  whileTap={{ scale: 0.96 }}
                  transition={SNAPPY_SPRING}
                >
                  {result.provider?.name || 'Provider'} · {result.score}% · {formatCurrency(result.offer.price, result.offer.currency)}
                </motion.button>
              )
            })}
          </div>
        </Reveal>
      )}

      <Reveal className={styles.desktopWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.rowLabelHeader}>
                <span className="sr-only">Criteria</span>
              </th>
              {selectedResults.map((result) => (
                <motion.th
                  scope="col"
                  key={result.offer.id}
                  className={result.offer.id === topOfferId ? styles.topMatchHead : undefined}
                  {...cellIn}
                >
                  <UserMiniCard user={result.provider} />
                </motion.th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className={styles.rowLabel}>
                  {row.label}
                </th>
                {selectedResults.map((result) => (
                  <motion.td
                    key={result.offer.id}
                    className={result.offer.status === 'accepted' ? styles.acceptedCell : undefined}
                    {...cellIn}
                  >
                    {row.render(result)}
                  </motion.td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className={styles.rowLabel}>
                Actions
              </th>
              {selectedResults.map((result) => (
                <td
                  key={result.offer.id}
                  className={result.offer.status === 'accepted' ? styles.acceptedCell : undefined}
                >
                  <div className={styles.actionButtons}>{renderActions(result.offer)}</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Reveal>

      <RevealGroup className={styles.mobileList}>
        {selectedResults.map((result) => (
          <Reveal key={result.offer.id}>
            <OfferCard
              offer={result.offer}
              provider={result.provider}
              actions={renderActions(result.offer)}
              tag={result.strength}
              matchReasoning={`${result.score}% · ${result.label} — ${result.reasons.slice(0, 2).join(', ')}`}
            />
          </Reveal>
        ))}
      </RevealGroup>
    </RevealGroup>
  )
}
