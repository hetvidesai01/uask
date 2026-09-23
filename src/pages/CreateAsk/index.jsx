import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StepIndicator from '../../components/ui/StepIndicator'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import AskFormStep1 from '../../components/ask/AskFormStep1'
import AskFormStep2 from '../../components/ask/AskFormStep2'
import AskFormStep3 from '../../components/ask/AskFormStep3'
import AskFormStep4 from '../../components/ask/AskFormStep4'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { getCategories, createAsk } from '../../services/askService'
import { isRequired, minLength, isPositiveNumber } from '../../utils/validators'
import styles from './CreateAsk.module.css'

const DRAFT_KEY = 'uask.draft.createAsk'
const STEPS = ['What you need', 'Details', 'Attachments', 'Review']

const DEFAULT_VALUES = {
  title: '',
  category: '',
  description: '',
  budgetMin: '',
  budgetMax: '',
  currency: 'USD',
  deadline: '',
  location: '',
  isRemote: '',
  attachments: [],
  requirements: '',
}

const DEFAULT_DRAFT = { step: 1, values: DEFAULT_VALUES }

function hasDraftContent(draft) {
  if (!draft) return false
  if (draft.step > 1) return true

  const v = draft.values
  return Boolean(
    v.title ||
      v.category ||
      v.description ||
      v.budgetMin ||
      v.budgetMax ||
      v.deadline ||
      v.location ||
      v.isRemote ||
      v.requirements ||
      v.attachments.length > 0
  )
}

function validateStep(step, values) {
  const errors = {}

  if (step === 1) {
    if (!isRequired(values.title)) errors.title = 'Enter a title.'
    else if (!minLength(values.title, 5)) errors.title = 'Title must be at least 5 characters.'

    if (!isRequired(values.category)) errors.category = 'Choose a category.'

    if (!isRequired(values.description)) errors.description = 'Describe what you need.'
    else if (!minLength(values.description, 20)) {
      errors.description = 'Add a bit more detail (at least 20 characters).'
    }
  }

  if (step === 2) {
    if (!isPositiveNumber(values.budgetMin)) errors.budgetMin = 'Enter a minimum budget.'

    if (!isPositiveNumber(values.budgetMax)) errors.budgetMax = 'Enter a maximum budget.'
    else if (isPositiveNumber(values.budgetMin) && Number(values.budgetMax) < Number(values.budgetMin)) {
      errors.budgetMax = 'Maximum must be at least the minimum budget.'
    }

    if (!isRequired(values.deadline)) errors.deadline = 'Choose a deadline.'
    else if (new Date(values.deadline) < new Date(new Date().toDateString())) {
      errors.deadline = 'Deadline must be today or later.'
    }

    if (!isRequired(values.location)) errors.location = 'Enter a location.'

    if (!isRequired(values.isRemote)) errors.isRemote = 'Choose remote or on-site.'
  }

  return errors
}

export default function CreateAsk() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [draft, setDraft] = useLocalStorage(DRAFT_KEY, DEFAULT_DRAFT)
  const [errors, setErrors] = useState({})
  const [categories, setCategories] = useState([])
  const [publishing, setPublishing] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [hadSavedDraft] = useState(() => hasDraftContent(draft))

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

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

  function handleDiscard() {
    setDraft(DEFAULT_DRAFT)
    setErrors({})
    setDiscardOpen(false)
  }

  async function handlePublish() {
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

    setPublishing(true)
    try {
      const created = await createAsk({
        title: values.title.trim(),
        category: values.category,
        description: values.requirements.trim()
          ? `${values.description.trim()}\n\nRequirements: ${values.requirements.trim()}`
          : values.description.trim(),
        budgetMin: Number(values.budgetMin),
        budgetMax: Number(values.budgetMax),
        currency: values.currency,
        deadline: new Date(values.deadline).toISOString(),
        location: values.location.trim(),
        isRemote: values.isRemote === 'true',
        attachments: values.attachments,
        requesterId: user.id,
      })
      setDraft(null)
      showToast('Your ASK is live.')
      navigate(`/app/asks/${created.id}`)
    } catch {
      showToast('Something went wrong publishing your ASK. Please try again.', 'error')
      setPublishing(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Create ASK</h1>
          <p className={styles.subtitle}>Tell providers what you need — it takes about a minute.</p>
        </div>
        {hadSavedDraft && (
          <Button variant="ghost" size="sm" onClick={() => setDiscardOpen(true)}>
            Start over
          </Button>
        )}
      </div>

      <StepIndicator steps={STEPS} current={step} />

      <Card padding="lg" className={styles.card}>
        {step === 1 && (
          <AskFormStep1 values={values} errors={errors} categories={categories} onChange={updateValues} />
        )}
        {step === 2 && <AskFormStep2 values={values} errors={errors} onChange={updateValues} />}
        {step === 3 && <AskFormStep3 values={values} onChange={updateValues} />}
        {step === 4 && <AskFormStep4 values={values} onEdit={goToStep} />}

        <div className={styles.controls}>
          <Button variant="ghost" onClick={handleBack} disabled={step === 1}>
            Back
          </Button>
          {step < STEPS.length ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handlePublish} loading={publishing}>
              Post ASK
            </Button>
          )}
        </div>
      </Card>

      <Modal open={discardOpen} onClose={() => setDiscardOpen(false)} title="Start over?">
        <div className={styles.modalBody}>
          <p className={styles.modalText}>
            This clears everything you&apos;ve entered so far. This can&apos;t be undone.
          </p>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setDiscardOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDiscard}>
              Discard draft
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
