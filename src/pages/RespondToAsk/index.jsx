import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import StepIndicator from '../../components/ui/StepIndicator'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import OfferFormStep1 from '../../components/offer/OfferFormStep1'
import OfferFormStep2 from '../../components/offer/OfferFormStep2'
import OfferFormStep3 from '../../components/offer/OfferFormStep3'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { getAskById, incrementResponseCount } from '../../services/askService'
import { getOffersForAsk, createOffer } from '../../services/offerService'
import { isRequired, minLength, isPositiveNumber } from '../../utils/validators'
import styles from './RespondToAsk.module.css'

const STEPS = ['Your offer', "Why you're a fit", 'Review']

const DEFAULT_VALUES = {
  price: '',
  currency: 'USD',
  deliveryDays: '',
  deliverables: [],
  pitch: '',
  experience: '',
  portfolioLinks: '',
  attachments: [],
}

const DEFAULT_DRAFT = { step: 1, values: DEFAULT_VALUES }

function validateStep(step, values) {
  const errors = {}

  if (step === 1) {
    if (!isPositiveNumber(values.price)) errors.price = 'Enter a price.'
    if (!isPositiveNumber(values.deliveryDays)) errors.deliveryDays = 'Enter a delivery timeline.'
    if (values.deliverables.length === 0) {
      errors.deliverables = "Add at least one thing that's included."
    }
  }

  if (step === 2) {
    if (!isRequired(values.pitch)) errors.pitch = 'Tell the seeker why you\'re a fit.'
    else if (!minLength(values.pitch, 20)) errors.pitch = 'Add a bit more detail (at least 20 characters).'
  }

  return errors
}

export default function RespondToAsk() {
  const { askId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [status, setStatus] = useState('loading')
  const [blockReason, setBlockReason] = useState(null)
  const [ask, setAsk] = useState(null)

  const [draft, setDraft] = useLocalStorage(`uask.draft.respond.${askId}`, DEFAULT_DRAFT)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const foundAsk = await getAskById(askId)
      if (!foundAsk) {
        setStatus('not_found')
        return
      }

      if (foundAsk.requesterId === user.id) {
        setAsk(foundAsk)
        setBlockReason('own_ask')
        setStatus('blocked')
        return
      }

      if (foundAsk.status !== 'open') {
        setAsk(foundAsk)
        setBlockReason('not_open')
        setStatus('blocked')
        return
      }

      const offers = await getOffersForAsk(askId)
      if (offers.some((offer) => offer.providerId === user.id)) {
        setAsk(foundAsk)
        setBlockReason('already_responded')
        setStatus('blocked')
        return
      }

      setAsk(foundAsk)
      setStatus('form')
    } catch {
      setStatus('error')
    }
  }, [askId, user.id])

  useEffect(() => {
    load()
  }, [load])

  const { step, values } = draft ?? DEFAULT_DRAFT

  function updateValues(field, value) {
    setDraft((current) => ({ ...current, values: { ...current.values, [field]: value } }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function goToStep(nextStep) {
    setErrors({})
    setDraft((current) => ({ ...current, step: nextStep }))
  }

  function handleNext() {
    const stepErrors = validateStep(step, values)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    goToStep(Math.min(step + 1, STEPS.length))
  }

  function handleBack() {
    goToStep(Math.max(step - 1, 1))
  }

  async function handleSubmit() {
    const step1Errors = validateStep(1, values)
    const step2Errors = validateStep(2, values)

    if (Object.keys(step1Errors).length > 0) {
      setErrors(step1Errors)
      goToStep(1)
      return
    }
    if (Object.keys(step2Errors).length > 0) {
      setErrors(step2Errors)
      goToStep(2)
      return
    }

    let composedPitch = values.pitch.trim()
    if (values.experience.trim()) {
      composedPitch += `\n\nRelevant experience: ${values.experience.trim()}`
    }
    if (values.portfolioLinks.trim()) {
      composedPitch += `\n\nPortfolio: ${values.portfolioLinks.trim()}`
    }

    setSubmitting(true)
    try {
      await createOffer({
        askId,
        providerId: user.id,
        price: Number(values.price),
        currency: values.currency,
        deliveryDays: Number(values.deliveryDays),
        pitch: composedPitch,
        deliverables: values.deliverables,
        attachments: values.attachments,
      })
      await incrementResponseCount(askId)

      setDraft(null)
      showToast('Your response was submitted.')
      navigate(`/app/asks/${askId}`)
    } catch {
      showToast('Something went wrong submitting your response. Please try again.', 'error')
      setSubmitting(false)
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
          title="Couldn't load this ASK"
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

  if (status === 'blocked') {
    const content = {
      own_ask: {
        icon: '🚫',
        title: 'This is your ASK',
        message: "You can't submit a response to your own ASK.",
      },
      not_open: {
        icon: '🔒',
        title: 'Not accepting responses',
        message: `This ASK is currently "${ask.status.replace('_', ' ')}" and isn't open for new responses.`,
      },
      already_responded: {
        icon: '✅',
        title: 'You already responded',
        message: "You've already submitted an offer for this ASK.",
      },
    }[blockReason]

    return (
      <div className={styles.centered}>
        <EmptyState
          icon={content.icon}
          title={content.title}
          message={content.message}
          action={
            <Button as={Link} to={`/app/asks/${askId}`} variant="secondary">
              Back to ASK
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Respond to this ASK</h1>
        <p className={styles.subtitle}>{ask.title}</p>
      </div>

      <StepIndicator steps={STEPS} current={step} />

      <Card padding="lg" className={styles.card}>
        {step === 1 && <OfferFormStep1 values={values} errors={errors} onChange={updateValues} />}
        {step === 2 && <OfferFormStep2 values={values} errors={errors} onChange={updateValues} />}
        {step === 3 && <OfferFormStep3 values={values} onEdit={goToStep} />}

        <div className={styles.controls}>
          <Button variant="ghost" onClick={handleBack} disabled={step === 1}>
            Back
          </Button>
          {step < STEPS.length ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} loading={submitting}>
              Submit response
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
