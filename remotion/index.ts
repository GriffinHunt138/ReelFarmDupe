/**
 * remotion/index.ts — entry point for @remotion/bundler.
 *
 * Must call registerRoot() exactly once.
 */
import { registerRoot } from 'remotion';
import { RemotionRoot }  from './Root';

registerRoot(RemotionRoot);
