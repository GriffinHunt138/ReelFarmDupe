/**
 * remotion/Root.tsx
 *
 * Remotion root — registers every composition this project uses.
 * The durationInFrames and inputProps here are defaults; the render helper
 * overrides them per-call via selectComposition().
 */

import React from 'react';
import { Composition } from 'remotion';
import { SlideComposition, type SlideContent } from './SlideComposition';

const DEFAULT_CONTENT: SlideContent = {
  headline: 'Preview slide',
  body:     'Body text goes here.',
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SlideComposition"
        component={SlideComposition}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={300}
        defaultProps={{ content: DEFAULT_CONTENT }}
      />
    </>
  );
};
