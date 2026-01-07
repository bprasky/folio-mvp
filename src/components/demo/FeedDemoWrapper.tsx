'use client';

/**
 * Client wrapper for feed page demo components
 * This ensures client components work properly when rendered from a server component
 */

import IndividualCinematicIntro from './IndividualCinematicIntro';
import DemoGuidedTour from './DemoGuidedTour';

export default function FeedDemoWrapper() {
  return (
    <>
      <IndividualCinematicIntro />
      <DemoGuidedTour role="individual" />
    </>
  );
}




