'use client';

import VendorCinematicIntro from './VendorCinematicIntro';
import DemoGuidedTour from './DemoGuidedTour';

export default function VendorCinematicIntroWrapper() {
  return (
    <>
      <VendorCinematicIntro />
      <DemoGuidedTour role="vendor" />
    </>
  );
}

