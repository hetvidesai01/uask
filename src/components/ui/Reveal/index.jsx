import { Children, createContext, useContext } from 'react'
import { motion } from 'framer-motion'
import { revealGroup, revealItem, revealGroupCalm, revealItemCalm } from '../../../utils/motion'

// `calm` picks the quieter variants (forms, settings, contract). It is passed
// down by context, so <Reveal> children of a calm group are calm too.
const CalmContext = createContext(false)

// Entrance helpers for logged-in screens. <RevealGroup> plays once on mount
// and staggers its <Reveal> children. `each` wraps every direct child in a
// <Reveal> for you, so existing markup doesn't need editing.
export function RevealGroup({ as = 'div', calm = false, each = false, children, ...rest }) {
  const Component = motion[as] ?? motion.div
  return (
    <CalmContext.Provider value={calm}>
      <Component initial="hidden" animate="visible" variants={calm ? revealGroupCalm : revealGroup} {...rest}>
        {each
          ? Children.toArray(children).map((child, index) => <Reveal key={child.key ?? index}>{child}</Reveal>)
          : children}
      </Component>
    </CalmContext.Provider>
  )
}

export function Reveal({ as = 'div', children, ...rest }) {
  const calm = useContext(CalmContext)
  const Component = motion[as] ?? motion.div
  return (
    <Component variants={calm ? revealItemCalm : revealItem} {...rest}>
      {children}
    </Component>
  )
}
