import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AskCard from '../../components/ask/AskCard'
import AskStatusBadge from '../../components/ask/AskStatusBadge'
import OfferCard from '../../components/offer/OfferCard'
import Button from '../../components/ui/Button'
import StatCard from '../../components/ui/StatCard'
import Tabs from '../../components/ui/Tabs'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import ActivityFeed from './ActivityFeed'
import { useCountUp } from './useCountUp'
import { useAuth } from '../../hooks/useAuth'
import { getAskById, getAsks } from '../../services/askService'
import { getOffersByProviderId, getOffersForAsk } from '../../services/offerService'
import styles from './DashboardOverview.module.css'

const ACTIVE_ASK_STATUSES = ['open', 'matched', 'in_review']
const ACTIVE_OFFER_STATUSES = ['pending', 'shortlisted']
const WON_OFFER_STATUSES = ['shortlisted', 'accepted']

const TAB_ITEMS = [
  { id: 'asks', label: 'My ASKs' },
  { id: 'offers', label: 'My Offers' },
  { id: 'activity', label: 'Recent Activity' },
]

function greetingForNow() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function buildActivity({ myAsks, myOffers, receivedOffers, askTitlesById }) {
  const events = []

  myAsks.forEach((ask) => {
    events.push({
      id: `ask-posted-${ask.id}`,
      date: ask.createdAt,
      icon: '📝',
      text: 'You posted ',
      linkText: ask.title,
      to: `/app/asks/${ask.id}`,
    })
  })

  myOffers.forEach((offer) => {
    const askTitle = askTitlesById[offer.askId]?.title ?? 'an ASK'
    events.push({
      id: `offer-submitted-${offer.id}`,
      date: offer.createdAt,
      icon: '📨',
      text: 'You submitted an offer on ',
      linkText: askTitle,
      to: `/app/asks/${offer.askId}`,
    })

    if (WON_OFFER_STATUSES.includes(offer.status)) {
      events.push({
        id: `offer-status-${offer.id}`,
        date: offer.createdAt,
        icon: offer.status === 'accepted' ? '✅' : '⭐',
        text: `Your offer was ${offer.status} on `,
        linkText: askTitle,
        to: `/app/asks/${offer.askId}`,
      })
    }
  })

  receivedOffers.forEach((offer) => {
    const askTitle = askTitlesById[offer.askId]?.title ?? 'an ASK'
    events.push({
      id: `response-received-${offer.id}`,
      date: offer.createdAt,
      icon: '💬',
      text: 'You received a response on ',
      linkText: askTitle,
      to: `/app/asks/${offer.askId}`,
    })
  })

  return events.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12)
}

export default function DashboardOverview() {
  const { user } = useAuth()

  const [status, setStatus] = useState('loading')
  const [myAsks, setMyAsks] = useState([])
  const [myOffers, setMyOffers] = useState([])
  const [askTitlesById, setAskTitlesById] = useState({})
  const [receivedOffers, setReceivedOffers] = useState([])
  const [activeTab, setActiveTab] = useState('asks')
  const didSetDefaultTab = useRef(false)

  const load = useCallback(async () => {
    if (!user) return
    setStatus('loading')
    try {
      const [asks, offers] = await Promise.all([
        getAsks({ requesterId: user.id }),
        getOffersByProviderId(user.id),
      ])

      const offerAskIds = [...new Set(offers.map((offer) => offer.askId))]
      const [offerAsks, receivedByAsk] = await Promise.all([
        Promise.all(offerAskIds.map((id) => getAskById(id))),
        Promise.all(asks.map((ask) => getOffersForAsk(ask.id))),
      ])

      const titles = {}
      offerAsks.filter(Boolean).forEach((ask) => {
        titles[ask.id] = ask
      })
      asks.forEach((ask) => {
        titles[ask.id] = ask
      })

      setMyAsks(asks)
      setMyOffers(offers)
      setAskTitlesById(titles)
      setReceivedOffers(receivedByAsk.flat())
      setStatus('done')

      if (!didSetDefaultTab.current) {
        setActiveTab(offers.length > asks.length ? 'offers' : 'asks')
        didSetDefaultTab.current = true
      }
    } catch {
      setStatus('error')
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(
    () => ({
      activeAsks: myAsks.filter((ask) => ACTIVE_ASK_STATUSES.includes(ask.status)).length,
      responsesReceived: receivedOffers.length,
      activeOffers: myOffers.filter((offer) => ACTIVE_OFFER_STATUSES.includes(offer.status)).length,
      wonOffers: myOffers.filter((offer) => WON_OFFER_STATUSES.includes(offer.status)).length,
    }),
    [myAsks, myOffers, receivedOffers]
  )

  const activity = useMemo(
    () => buildActivity({ myAsks, myOffers, receivedOffers, askTitlesById }),
    [myAsks, myOffers, receivedOffers, askTitlesById]
  )

  // Hooks must run unconditionally on every render, so these are called
  // here rather than after the loading/error early returns below.
  const activeAsksCount = useCountUp(stats.activeAsks)
  const responsesReceivedCount = useCountUp(stats.responsesReceived)
  const activeOffersCount = useCountUp(stats.activeOffers)
  const wonOffersCount = useCountUp(stats.wonOffers)

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
          title="Couldn't load your dashboard"
          message="Something went wrong loading your activity. Please try again."
          action={
            <Button variant="secondary" onClick={load}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  const firstName = user?.name?.split(' ')[0] ?? 'there'

  return (
    <div className={styles.overview}>
      <div className={styles.welcome}>
        <div>
          <p className={styles.greeting}>
            <span className={styles.greetingRule} aria-hidden="true" />
            {greetingForNow()}, {firstName}
          </p>
          <h1 className={styles.title}>Here's what's happening with your ASKs and offers.</h1>
        </div>
        <Button as={Link} to="/app/asks/new">
          + Post an ASK
        </Button>
      </div>

      <div className={styles.stats}>
        <StatCard label="Active ASKs" value={activeAsksCount} />
        <StatCard label="Responses received" value={responsesReceivedCount} />
        <StatCard label="Active offers" value={activeOffersCount} />
        <StatCard label="Shortlisted / accepted" value={wonOffersCount} />
      </div>

      <div className={styles.tabsSection}>
        <Tabs items={TAB_ITEMS} active={activeTab} onChange={setActiveTab} />

        <div className={styles.panel}>
          {activeTab === 'asks' &&
            (myAsks.length === 0 ? (
              <EmptyState
                icon="🗂️"
                title="No ASKs yet"
                message="Post your first ASK to start getting responses from providers."
                action={
                  <Button as={Link} to="/app/asks/new" variant="secondary">
                    Post an ASK
                  </Button>
                }
              />
            ) : (
              <div className={styles.askGrid}>
                {myAsks.map((ask) => (
                  <AskCard key={ask.id} ask={ask} />
                ))}
              </div>
            ))}

          {activeTab === 'offers' &&
            (myOffers.length === 0 ? (
              <EmptyState
                icon="📨"
                title="No offers yet"
                message="Discover open ASKs and submit a response to start providing."
                action={
                  <Button as={Link} to="/app/discover" variant="secondary">
                    Discover ASKs
                  </Button>
                }
              />
            ) : (
              <div className={styles.offerGrid}>
                {myOffers.map((offer) => {
                  const ask = askTitlesById[offer.askId]
                  return (
                    <div key={offer.id} className={styles.offerGroup}>
                      <Link to={`/app/asks/${offer.askId}`} className={styles.offerAskLink}>
                        <span className={styles.offerAskTitle}>{ask?.title ?? 'View ASK'}</span>
                        {ask && <AskStatusBadge status={ask.status} />}
                      </Link>
                      <OfferCard offer={offer} provider={user} />
                    </div>
                  )
                })}
              </div>
            ))}

          {activeTab === 'activity' && <ActivityFeed items={activity} />}
        </div>
      </div>
    </div>
  )
}
