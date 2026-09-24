import { useState } from 'react'
import { motion } from 'framer-motion'

import AnimatedCounter from '../../components/ui/AnimatedCounter'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import FloatingCard from '../../components/ui/FloatingCard'
import GradientMesh from '../../components/ui/GradientMesh'
import HandUnderline from '../../components/ui/HandUnderline'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import SignalMark from '../../components/ui/SignalMark'
import StaggerReveal from '../../components/ui/StaggerReveal'
import StatCard from '../../components/ui/StatCard'
import Tabs from '../../components/ui/Tabs'
import Textarea from '../../components/ui/Textarea'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import {
  cardEntrance,
  fadeRise,
  hoverLift,
  lineReveal,
  pageEntrance,
  springScale,
  staggerItem,
} from '../../utils/motion'
import styles from './DesignPreview.module.css'

const NEUTRAL_TOKENS = [
  ['--canvas', 'Canvas'],
  ['--surface', 'Surface'],
  ['--blush', 'Blush'],
  ['--blush-deep', 'Blush deep'],
  ['--border', 'Border'],
  ['--border-strong', 'Border strong'],
  ['--ink', 'Ink'],
  ['--ink-mute', 'Ink mute'],
  ['--ink-faint', 'Ink faint'],
]

const BRAND_TOKENS = [
  ['--red', 'Red'],
  ['--red-deep', 'Red deep'],
  ['--burgundy', 'Burgundy'],
  ['--pink', 'Pink'],
  ['--pink-tagline', 'Pink tagline'],
]

const STATUS_TOKENS = [
  ['--c-success', 'Success'],
  ['--c-warning', 'Warning'],
  ['--c-info', 'Info'],
  ['--c-danger', 'Danger'],
]

const RADIUS_TOKENS = [
  ['--r-sm', 'Small'],
  ['--r-md', 'Medium'],
  ['--r-lg', 'Large'],
  ['--r-full', 'Pill'],
]

const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'danger']
const BADGE_VARIANTS = ['open', 'matched', 'in_review', 'closed', 'accepted', 'rejected']
const TAB_ITEMS = [
  { id: 'one', label: 'My ASKs' },
  { id: 'two', label: 'My Offers' },
  { id: 'three', label: 'Activity' },
]

export default function DesignPreview() {
  const [tab, setTab] = useState('one')
  const [modalOpen, setModalOpen] = useState(false)
  const [note, setNote] = useState('')
  const [counterValue, setCounterValue] = useState(128)
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.kicker}>Light Redesign — Phase 1: Design foundation</span>
        <h1 className={styles.h1}>UASK "Open Call" — light foundation preview</h1>
        <p className={styles.lead}>
          Internal, temporary route for inspecting the new light editorial palette, typography,
          motion primitives, and every UI atom before any page-level redesign. Not linked from
          product navigation — remove once page-by-page phases are underway.
        </p>
        <p className={styles.reducedMotionReadout}>
          <code>useReducedMotion()</code> currently reports:{' '}
          <strong>{prefersReducedMotion ? 'reduced' : 'no preference'}</strong> — toggle your OS
          "reduce motion" setting and reload to verify.
        </p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.h2}>Tokens</h2>

        <h3 className={styles.h3}>Neutrals</h3>
        <div className={styles.swatchGrid}>
          {NEUTRAL_TOKENS.map(([token, label]) => (
            <Swatch key={token} token={token} label={label} />
          ))}
        </div>

        <h3 className={styles.h3}>Brand</h3>
        <div className={styles.swatchGrid}>
          {BRAND_TOKENS.map(([token, label]) => (
            <Swatch key={token} token={token} label={label} />
          ))}
        </div>

        <h3 className={styles.h3}>Status</h3>
        <div className={styles.swatchGrid}>
          {STATUS_TOKENS.map(([token, label]) => (
            <Swatch key={token} token={token} label={label} />
          ))}
        </div>

        <h3 className={styles.h3}>Radius</h3>
        <div className={styles.row}>
          {RADIUS_TOKENS.map(([token, label]) => (
            <div key={token} className={styles.radiusSwatch} style={{ borderRadius: `var(${token})` }}>
              {label}
            </div>
          ))}
        </div>

        <h3 className={styles.h3}>Gradient, glow &amp; shadow</h3>
        <div className={styles.row}>
          <div className={styles.gradientSwatch}>--grad-signal</div>
          <div className={styles.glowSwatch}>--glow-red-sm</div>
          <div className={styles.cardShadowSwatch}>--shadow-card</div>
          <div className={styles.liftShadowSwatch}>--shadow-lift</div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Typography</h2>
        <p className={styles.sectionNote}>
          Instrument Serif for editorial headings, Instrument Sans for UI/body, EB Garamond kept
          selectively for expressive moments, JetBrains Mono selectively for data/numerals.
        </p>
        <p className={styles.displaySample}>Ask for what you need.</p>
        <p className={styles.bodySample}>
          Body copy in Instrument Sans — the workhorse text style used everywhere outside
          editorial headings and section titles.
        </p>
        <p className={styles.heritageSample}>An occasional heritage flourish, used sparingly.</p>
        <p className={styles.monoSample}>₹1,24,500.00 · 12 Sep 2026, 14:32 · #UASK-0284</p>
        <p className={styles.underlineSample}>
          Post an <HandUnderline>ASK</HandUnderline>, not a listing.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>SignalMark</h2>
        <p className={styles.sectionNote}>
          Central red dot with optional radiating rings — configurable size and animated/static
          state. Reusable for loading, empty states, milestones, status paths, hero graphics, and
          Profile Booster.
        </p>
        <div className={styles.row}>
          <LabeledSwatch label="sm, static">
            <SignalMark size="sm" />
          </LabeledSwatch>
          <LabeledSwatch label="md, static">
            <SignalMark size="md" />
          </LabeledSwatch>
          <LabeledSwatch label="lg, static">
            <SignalMark size="lg" />
          </LabeledSwatch>
          <LabeledSwatch label="md, animated (reveal once)">
            <SignalMark size="md" animated />
          </LabeledSwatch>
          <LabeledSwatch label="md, 3 rings">
            <SignalMark size="md" rings={3} />
          </LabeledSwatch>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Motion primitives</h2>
        <p className={styles.sectionNote}>
          Demonstration only — these variants are not applied to any real page yet. Full hero
          animations and screen transitions come in later phases.
        </p>

        <h3 className={styles.h3}>Line reveal</h3>
        <div className={styles.lineRevealWrap}>
          <motion.span
            className={styles.lineRevealText}
            initial="hidden"
            animate="visible"
            variants={lineReveal}
          >
            The signal cuts through.
          </motion.span>
        </div>

        <h3 className={styles.h3}>Stagger group</h3>
        <StaggerReveal className={styles.staggerGrid}>
          {['ASK', 'MATCH', 'RESPOND', 'COMPARE', 'CONNECT'].map((label) => (
            <motion.div key={label} className={styles.staggerChip} variants={staggerItem}>
              {label}
            </motion.div>
          ))}
        </StaggerReveal>

        <h3 className={styles.h3}>Fade + rise / spring scale / page entrance</h3>
        <div className={styles.row}>
          <motion.div className={styles.motionTile} initial="hidden" animate="visible" variants={fadeRise}>
            fade + rise
          </motion.div>
          <motion.div className={styles.motionTile} initial="hidden" animate="visible" variants={springScale}>
            spring scale
          </motion.div>
          <motion.div className={styles.motionTile} initial="hidden" animate="visible" variants={pageEntrance}>
            page entrance
          </motion.div>
        </div>

        <h3 className={styles.h3}>Card entrance + hover lift</h3>
        <motion.div
          className={styles.motionCard}
          initial="hidden"
          animate="visible"
          variants={cardEntrance}
          whileHover="hover"
        >
          <motion.div variants={hoverLift}>
            <Card padding="md">
              <p className={styles.cardTitle}>Mounts in, lifts on hover</p>
              <p className={styles.cardBody}>Restrained — translate only, no scale or tilt.</p>
            </Card>
          </motion.div>
        </motion.div>

        <h3 className={styles.h3}>Animated counter</h3>
        <div className={styles.row}>
          <StatCard
            label="Open ASKs"
            value={<AnimatedCounter value={counterValue} />}
          />
          <Button size="sm" variant="ghost" onClick={() => setCounterValue((v) => (v === 128 ? 342 : 128))}>
            Toggle value
          </Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Reusable wrappers</h2>
        <p className={styles.sectionNote}>FloatingCard — a Card that lifts with a deeper directional shadow on hover/focus.</p>
        <div className={styles.row}>
          <FloatingCard padding="md">
            <p className={styles.cardTitle}>Floating card</p>
            <p className={styles.cardBody}>Hover or focus to see the shadow lift.</p>
          </FloatingCard>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Graphics — gradient mesh</h2>
        <div className={styles.meshDemo}>
          <GradientMesh />
          <p className={styles.meshDemoText}>Reserved for hero/CTA sections, later phases.</p>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Buttons</h2>
        <div className={styles.row}>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className={styles.invertedBand}>
          <Button inverted variant="primary">
            Inverted primary
          </Button>
          <Button inverted variant="secondary">
            Inverted secondary
          </Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Form fields</h2>
        <div className={styles.formGrid}>
          <Input label="Title" placeholder="What do you need?" />
          <Input label="Title (error)" error="This field is required" defaultValue="" />
          <Input label="Title (disabled)" disabled defaultValue="Can't edit this" />
          <Select
            label="Category"
            options={[
              { value: 'design', label: 'Design' },
              { value: 'dev', label: 'Development' },
            ]}
          />
          <Select
            label="Category (error)"
            error="Pick a category"
            options={[{ value: 'design', label: 'Design' }]}
          />
          <Textarea
            label="Description"
            maxLength={120}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Cards</h2>
        <div className={styles.row}>
          <Card padding="md">Default card</Card>
          <Card padding="md" hoverable>
            Hoverable card
          </Card>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Badges</h2>
        <div className={styles.row}>
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Tabs</h2>
        <Tabs items={TAB_ITEMS} active={tab} onChange={setTab} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Modal</h2>
        <Button onClick={() => setModalOpen(true)}>Open modal</Button>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Light modal preview">
          <p className={styles.cardBody}>Sits on the warm-ink overlay scrim with a hairline border.</p>
        </Modal>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Stat cards</h2>
        <div className={styles.row}>
          <StatCard label="Open ASKs" value="12" delta={8} />
          <StatCard label="Response rate" value="64%" delta={-5} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Avatar</h2>
        <div className={styles.row}>
          <Avatar name="Priya Shah" size="sm" />
          <Avatar name="Priya Shah" size="md" />
          <Avatar name="Priya Shah" size="lg" />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Empty state</h2>
        <EmptyState
          icon="📭"
          title="No ASKs yet"
          message="Post your first request and providers will start responding."
          action={<Button size="sm">Post an ASK</Button>}
        />
      </section>
    </div>
  )
}

function Swatch({ token, label }) {
  return (
    <div className={styles.swatch}>
      <div className={styles.swatchColor} style={{ backgroundColor: `var(${token})` }} />
      <div className={styles.swatchLabel}>{label}</div>
      <div className={styles.swatchToken}>{token}</div>
    </div>
  )
}

function LabeledSwatch({ label, children }) {
  return (
    <div className={styles.labeledSwatch}>
      {children}
      <div className={styles.swatchLabel}>{label}</div>
    </div>
  )
}
