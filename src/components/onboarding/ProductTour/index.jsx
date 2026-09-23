import { useState } from 'react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import StepIndicator from '../../ui/StepIndicator'
import { useAuth } from '../../../hooks/useAuth'
import { useLocalStorage } from '../../../hooks/useLocalStorage'
import { onboardingStorageKey } from '../../../utils/onboarding'
import styles from './ProductTour.module.css'

const STEPS = [
  {
    label: 'Discover',
    icon: '🔍',
    description:
      'Explore live ASKs from people who need help. Filter by category, budget and location to find ones that fit.',
  },
  {
    label: 'Create ASK',
    icon: '✏️',
    description:
      'Need something done? Post an ASK in a couple of minutes and let providers come to you with offers.',
  },
  {
    label: 'Inbox',
    icon: '📥',
    description: 'All your messages and notifications live here — offers, updates and conversations in one place.',
  },
  {
    label: 'Dashboard',
    icon: '🏠',
    description: 'Your home base — track your ASKs, offers, payments and milestones at a glance.',
  },
  {
    label: 'Profile',
    icon: '👤',
    description: 'Showcase your work, ratings and categories. A strong profile helps you stand out.',
  },
]

export default function ProductTour() {
  const { user } = useAuth()
  const [completed, setCompleted] = useLocalStorage(onboardingStorageKey(user.id), false)
  const [stepIndex, setStepIndex] = useState(0)

  if (completed) return null

  const step = STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === STEPS.length - 1

  function handleFinish() {
    setCompleted(true)
  }

  function handleNext() {
    if (isLast) {
      handleFinish()
      return
    }
    setStepIndex((index) => index + 1)
  }

  function handleBack() {
    setStepIndex((index) => Math.max(0, index - 1))
  }

  return (
    <Modal open onClose={handleFinish} title={`${stepIndex + 1}. ${step.label}`}>
      <div className={styles.tour}>
        <StepIndicator steps={STEPS.map((item) => item.label)} current={stepIndex + 1} />

        <div className={styles.body}>
          <span className={styles.icon} aria-hidden="true">
            {step.icon}
          </span>
          <p className={styles.description}>{step.description}</p>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.skipButton} onClick={handleFinish}>
            Skip
          </button>

          <div className={styles.navButtons}>
            {!isFirst && (
              <Button variant="secondary" size="sm" onClick={handleBack}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
