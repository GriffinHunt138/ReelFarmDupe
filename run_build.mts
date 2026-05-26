import { buildClipLibrary } from './lib/stability/clip-library';
const count = await buildClipLibrary(['9090_breathing']);
console.log(`Done — ${count} clip(s) completed`);
