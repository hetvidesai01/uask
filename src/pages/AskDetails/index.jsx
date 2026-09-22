import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AskStatusBadge from '../../components/ask/AskStatusBadge'
import AskMetaGrid from '../../components/ask/AskMetaGrid'
import UserMiniCard from '../../components/ask/UserMiniCard'
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
import styles from './AskDetails.module.css'

export default function AskDetails() {
  const { askId } = useParams()
  const { user } = useAuth()

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.category}>{ask.category}</span>
          <AskStatusBadge status={ask.status} />
        </div>
        <h1 className={styles.title}>{ask.title}</h1>
        <p className={styles.posted}>Posted {formatRelativeDate(ask.createdAt)}</p>
      </div>

      <StatusRail status={ask.status} />

      <UserMiniCard user={requester} label="Posted by" />

      <p className={styles.description}>{ask.description}</p>

      <AskMetaGrid ask={ask} />

      {ask.attachments.length > 0 && (
        <div className={styles.attachments}>
          <h2 className={styles.sectionTitle}>Attachments</h2>
          <div className={styles.attachmentList}>
            {ask.attachments.map((file) => (
              <Tag key={file.name}>{file.name}</Tag>
            ))}
          </div>
        </div>
      )}

      <hr className={styles.divider} />

      {isOwner ? (
        <div className={styles.responsesSection}>
          <div className={styles.responsesHeader}>
            <h2 className={styles.sectionTitle}>Responses ({offers.length})</h2>
            {offers.length > 0 && (
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
      ) : (
        <Card className={styles.responseCta}>
          <div>
            <h2 className={styles.sectionTitle}>Interested in this ASK?</h2>
            <p className={styles.ctaText}>Submit a response with your price, timeline, and pitch.</p>
          </div>
          <Button as={Link} to={`/app/asks/${askId}/respond`}>
            Submit a response
          </Button>
        </Card>
      )}
    </div>
  )
}
