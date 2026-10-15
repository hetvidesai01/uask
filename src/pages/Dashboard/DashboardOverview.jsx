import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ContractLink from '../../components/contract/ContractLink'
import { getContractsForUser } from '../../services/contractService'
import { motion } from 'framer-motion'
import { Reveal, RevealGroup } from '../../components/ui/Reveal'
import MotionCard from '../../components/ui/MotionCard'
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
  const [contractsByAskId, setContractsByAskId] = useState({})
  const [activeTab, setActiveTab] = useState('asks')
  const didSetDefaultTab = useRef(false)

  const load = useCallback(async () => {
    if (!user) return
    setStatus('loading')
    try {
      const [asks, offers, myContracts] = await Promise.all([
        getAsks({ requesterId: user.id }),
        getOffersByProviderId(user.id),
        getContractsForUser(user.id),
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
      setContractsByAskId(Object.fromEntries(myContracts.map((c) => [c.askId, c])))
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
          message="We could not load your activity. Please try again in a moment."
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
    <RevealGroup className={styles.overview}>
      <Reveal className={styles.welcome}>
        <div>
          <p className={styles.greeting}>
            <span className={styles.greetingRule} aria-hidden="true" />
            {greetingForNow()}, {firstName}
          </p>
          <h1 className={styles.title}>Here's what's happening with your ASKs and offers.</h1>
        </div>
      </Reveal>

      {/* TEMPORARY testing shortcut — remove after Contract UI review. */}
      <Reveal>
        <Button as={Link} to="/app/asks/ask-7/contract">
          Open Demo Contract
        </Button>
      </Reveal>

      <RevealGroup className={styles.stats}>
        <StatCard icon="🗂️" label="Active ASKs" value={activeAsksCount} />
        <StatCard icon="📨" label="Responses received" value={responsesReceivedCount} />
        <StatCard icon="📤" label="Active offers" value={activeOffersCount} />
        <StatCard icon="⭐" label="Shortlisted / accepted" value={wonOffersCount} />
      </RevealGroup>

      <Reveal className={styles.tabsSection}>
        <Tabs items={TAB_ITEMS} active={activeTab} onChange={setActiveTab} />

        <motion.div
          key={activeTab}
          className={styles.panel}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'asks' &&
            (myAsks.length === 0 ? (
              <EmptyState
                icon="🗂️"
                title="No ASKs yet"
                message="Post your first ASK and offers from providers will start arriving here."
                action={
                  <Button as={Link} to="/app/asks/new" variant="secondary">
                    Post an ASK
                  </Button>
                }
              />
            ) : (
              <RevealGroup className={styles.askGrid}>
                {myAsks.map((ask) => (
                  <Reveal key={ask.id}>
                    <MotionCard lift={2}>
                      <AskCard ask={ask} />
                    </MotionCard>
                    <ContractLink contract={contractsByAskId[ask.id]} />
                  </Reveal>
                ))}
              </RevealGroup>
            ))}

          {activeTab === 'offers' &&
            (myOffers.length === 0 ? (
              <EmptyState
                icon="📨"
                title="No offers yet"
                message="Browse open ASKs and send your first response to get started."
                action={
                  <Button as={Link} to="/app/discover" variant="secondary">
                    Discover ASKs
                  </Button>
                }
              />
            ) : (
              <RevealGroup className={styles.offerGrid}>
                {myOffers.map((offer) => {
                  const ask = askTitlesById[offer.askId]
                  return (
                    <Reveal key={offer.id} className={styles.offerGroup}>
                      <Link to={`/app/asks/${offer.askId}`} className={styles.offerAskLink}>
                        <span className={styles.offerAskTitle}>{ask?.title ?? 'View ASK'}</span>
                        {ask && <AskStatusBadge status={ask.status} />}
                      </Link>
                      <OfferCard offer={offer} provider={user} />
                      <ContractLink contract={contractsByAskId[offer.askId]} />
                    </Reveal>
                  )
                })}
              </RevealGroup>
            ))}

          {activeTab === 'activity' && <ActivityFeed items={activity} />}
        </motion.div>
      </Reveal>
    </RevealGroup>
  )
}
