import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeroMotion } from "@/components/landing/landing-hero-motion";
import LandingCapabilities from "@/components/landing/landing-capabilities";
import LandingWorkflowSection from "@/components/landing/landing-workflow-section";
import LandingPlatformSection from "@/components/landing/landing-platform-section";
import LandingPortalSection from "@/components/landing/landing-portal-section";
import LandingDevelopersSection from "@/components/landing/landing-developers-section";

export default function HomePage() {
  return (
    <div className="site-shell">
      <LandingHeroMotion />
      <LandingHeader />
      <main>
        <LandingCapabilities />
        <LandingWorkflowSection />
        <LandingPlatformSection />
        <LandingPortalSection />
        <LandingDevelopersSection />
      </main>
      <LandingFooter />
    </div>
  );
}
