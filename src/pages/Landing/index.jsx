import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import AnimatedBackground from '../../components/ui/AnimatedBackground'
import HeroSection from './HeroSection'
import FlowSection from './FlowSection'
import ReverseMarketplaceSection from './ReverseMarketplaceSection'
import ValuePropsSection from './ValuePropsSection'
import SampleAsksSection from './SampleAsksSection'
import CategoriesSection from './CategoriesSection'
import CtaSection from './CtaSection'
import styles from './Landing.module.css'

export default function Landing() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  return (
    <div className={styles.page}>
      <AnimatedBackground variant="expressive" />
      <HeroSection />
      <FlowSection />
      <ReverseMarketplaceSection />
      <ValuePropsSection />
      <SampleAsksSection />
      <CategoriesSection />
      <CtaSection />
    </div>
  )
}
