"use client";

import { HeroSection } from "./landing-v2/hero-section";
import { CampaignPlayground } from "./landing-v2/campaign-playground";
import { CreateSection } from "./landing-v2/create-section";
import { TemplateShowcase } from "./landing-v2/template-showcase";
import { DistributionSection } from "./landing-v2/distribution-section";
import { AnalyticsShowcase } from "./landing-v2/analytics-showcase";
import { JourneyShowcase } from "./landing-v2/journey-showcase";
import { AudienceShowcase } from "./landing-v2/audience-showcase";
import { SmartCardShowcase } from "./landing-v2/smart-card-showcase";
import { MiniPageBuilder } from "./landing-v2/mini-page-builder";
import { KnowledgeQuiz } from "./landing-v2/knowledge-quiz";
import { HowItWorks } from "./landing-v2/how-it-works";
import { UseCases } from "./landing-v2/use-cases";
import { PricingPreview } from "./landing-v2/pricing-preview";
import { FinalCTA } from "./landing-v2/final-cta";

export function LandingV2() {
  return (
    <div className="lv2">
      <HeroSection />
      <CampaignPlayground />
      <CreateSection />
      <TemplateShowcase />
      <DistributionSection />
      <AnalyticsShowcase />
      <JourneyShowcase />
      <AudienceShowcase />
      <SmartCardShowcase />
      <MiniPageBuilder />
      <KnowledgeQuiz />
      <HowItWorks />
      <UseCases />
      <PricingPreview />
      <FinalCTA />
    </div>
  );
}
