/**
 * Queue worker — automation disabled.
 * The queue is now a manual download list. Use the "Download All" button
 * in the Queue tab to copy slides to ~/Downloads/Faceless/.
 */

export async function processQueue(): Promise<{ processed: number; errors: string[] }> {
  return { processed: 0, errors: [] };
}

export function startQueueWorker() {
  console.log('[queue-worker] Automation disabled — queue is manual download mode');
}
