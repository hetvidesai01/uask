import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import AskStatusBadge from '../../components/ask/AskStatusBadge'
import AskMetaGrid from '../../components/ask/AskMetaGrid'
import Avatar from '../../components/ui/Avatar'
import AnimatedBackground from '../../components/ui/AnimatedBackground'
import OfferList from '../../components/offer/OfferList'
import OfferCard from '../../components/offer/OfferCard'
import Card from '../../components/ui/Card'
import Tag from '../../components/ui/Tag'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import StatusRail from './StatusRail'
import { useAuth } from '../../hooks/useAuth'
import { getAskById } from '../../services/askService'
import { getOffersForAsk } from '../../services/offerService'
import { getUserById } from '../../services/authService'
import { formatRelativeDate } from '../../utils/formatDate'
import { getProfileHeadline } from '../../utils/profileHeadline'
import { staggerContainer, staggerItem } from '../../utils/motion'
import styles from './AskDetails.module.css'

// The "Requirements or extra notes" step in Create ASK gets folded into
// the stored description with this exact marker (see CreateAsk's
// handlePublish) — splitting on it here lets the brief show "Description"
// and "Requirements & deliverables" as distinct sections without adding
// any new field to the ASK data model.
const REQUIREMENTS_MARKER = '\n\nRequirements: '

function splitDescription(description) {
  const markerIndex = description.indexOf(REQUIREMENTS_MARKER)
  if (markerIndex === -1) return { summary: description, requirements: null }
  return {
    summary: description.slice(0, markerIndex),
    requirements: description.slice(markerIndex + REQUIREMENTS_MARKER.length),
  }
}

export default function AskDetails() {
  const { askId } = useParams()
  const { user, activeRole } = useAuth()

  const [status, setStatus] = useState('loading')
  const [ask, setAsk] = useState(null)
  const [requester, setRequester] = useState(null)
  const [offers, setOffers] = useState([])
  const [providersById, setProvidersById] = useState({})

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const foundAsk = await getAskById(askId)
      if (!foundAsk) {
        setStatus('not_found')
        return
      }

      const [foundRequester, foundOffers] = await Promise.all([
        getUserById(foundAsk.requesterId),
        getOffersForAsk(askId),
      ])

      const providerIds = [...new Set(foundOffers.map((offer) => offer.providerId))]
      const providers = await Promise.all(providerIds.map((id) => getUserById(id)))
      const providerMap = Object.fromEntries(
        providers.filter(Boolean).map((provider) => [provider.id, provider])
      )

      setAsk(foundAsk)
      setRequester(foundRequester)
      setOffers(foundOffers)
      setProvidersById(providerMap)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }, [askId])

  useEffect(() => {
    load()
  }, [load])

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
          title="Couldn't load this ASK"
          message="Something went wrong loading this page. Please try again."
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

  const isOwner = user && ask.requesterId === user.id
  const myOffer = offers.find((offer) => offer.providerId === user?.id)
  const isAcceptedParty = ask.status === 'accepted' && (isOwner || myOffer?.status === 'accepted')
  const { summary, requirements } = splitDescription(ask.description)

  return (
    <div className={styles.page}>
      <AnimatedBackground variant="quiet" />
      <motion.div className={styles.brief} initial="hidden" animate="visible" variants={staggerContainer}>
        <motion.div className={styles.header} variants={staggerItem}>
          <div className={styles.headerTop}>
            <span className={styles.category}>{ask.category}</span>
            <AskStatusBadge status={ask.status} />
          </div>
          <h1 className={styles.title}>{ask.title}</h1>
          <p className={styles.posted}>Posted {formatRelativeDate(ask.createdAt)}</p>
        </motion.div>

        <motion.div variants={staggerItem}>
          <StatusRail status={ask.status} />
        </motion.div>

        {requester && (
          <motion.div variants={staggerItem}>
            <Link to={`/app/profile/${requester.id}`} className={styles.requesterCard}>
              <Avatar src={requester.avatarUrl} name={requester.name} size="lg" />
              <div className={styles.requesterInfo}>
                <span className={styles.requesterLabel}>Posted by</span>
                <span className={styles.requesterName}>{requester.name}</span>
                <span className={styles.requesterMeta}>
                  {getProfileHeadline(requester)}
                  {requester.location && ` · ${requester.location}`}
                  {requester.rating != null && ` · ★ ${requester.rating.toFixed(1)}`}
                </span>
              </div>
            </Link>
          </motion.div>
        )}

        <motion.div className={styles.section} variants={staggerItem}>
          <h2 className={styles.sectionTitle}>Description</h2>
          <p className={styles.description}>{summary}</p>
        </motion.div>

        {requirements && (
          <motion.div className={styles.section} variants={staggerItem}>
            <h2 className={styles.sectionTitle}>Requirements &amp; deliverables</h2>
            <p className={styles.description}>{requirements}</p>
          </motion.div>
        )}

        <motion.div variants={staggerItem}>
          <AskMetaGrid ask={ask} />
        </motion.div>

        {ask.attachments.length > 0 && (
          <motion.div className={styles.attachments} variants={staggerItem}>
            <h2 className={styles.sectionTitle}>Attachments</h2>
            <div className={styles.attachmentList}>
              {ask.attachments.map((file) => (
                <Tag key={file.name}>{file.name}</Tag>
              ))}
            </div>
          </motion.div>
        )}

        <motion.hr className={styles.divider} variants={staggerItem} />

        <motion.div variants={staggerItem}>
          {isAcceptedParty ? (
            <Card className={styles.contractCta}>
              <div>
                <h2 className={styles.sectionTitle}>This project is underway</h2>
                <p className={styles.ctaText}>
                  An offer has been accepted — track the contract, milestones, and payments.
                </p>
              </div>
              <Button as={Link} to={`/app/asks/${askId}/contract`}>
                View Contract
              </Button>
            </Card>
          ) : isOwner ? (
            <div className={styles.responsesSection}>
              <div className={styles.responsesHeader}>
                <h2 className={styles.sectionTitle}>Responses ({offers.length})</h2>
                {offers.length > 1 && (
                  <Button as={Link} to={`/app/asks/${askId}/compare`} variant="secondary">
                    Compare all
                  </Button>
                )}
              </div>
              <OfferList offers={offers} providersById={providersById} />
            </div>
          ) : myOffer ? (
            <Card className={styles.responseStatus}>
              <h2 className={styles.sectionTitle}>You already responded</h2>
              <OfferCard offer={myOffer} provider={user} />
            </Card>
          ) : activeRole === 'provider' ? (
            // Responding is a Provider action — hidden while acting as a Seeker,
            // and never shown for the requester's own ASK (handled by isOwner above).
            <Card className={styles.responseCta}>
              <div>
                <h2 className={styles.sectionTitle}>Interested in this ASK?</h2>
                <p className={styles.ctaText}>Submit a response with your price, timeline, and pitch.</p>
              </div>
              <Button as={Link} to={`/app/asks/${askId}/respond`}>
                Submit a response
              </Button>
            </Card>
          ) : null}
        </motion.div>
      </motion.div>
    </div>
  )
}
