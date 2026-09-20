import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import HeroSection from './HeroSection'
import FlowSection from './FlowSection'
import ValuePropsSection from './ValuePropsSection'
import SampleAsksSection from './SampleAsksSection'
import CategoriesSection from './CategoriesSection'
import CtaSection from './CtaSection'

export default function Landing() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  return (
    <div>
      <HeroSection />
      <FlowSection />
      <ValuePropsSection />
      <SampleAsksSection />
      <CategoriesSection />
      <CtaSection />
    </div>
  )
}
