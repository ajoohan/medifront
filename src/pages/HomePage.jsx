import Hero from '../components/Hero'
import Metrics from '../components/Metrics'
import Services from '../components/Services'
import PainPoints from '../components/PainPoints'
import Results from '../components/Results'
import Process from '../components/Process'
import AISection from '../components/AISection'
import Categories from '../components/Categories'
import FAQ from '../components/FAQ'
import Contact from '../components/Contact'
import useReveal from '../hooks/useReveal'

export default function HomePage() {
  useReveal()

  return (
    <>
      <Hero />
      <Metrics />
      <Services />
      <PainPoints />
      <Results />
      <Process />
      <AISection />
      <Categories />
      <FAQ />
      <Contact />
    </>
  )
}
