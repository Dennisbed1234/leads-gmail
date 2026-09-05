import Queue from 'bull';

const verificationQueue = new Queue('gmail-verification', {
  redis: { host: 'localhost', port: 6379 }
});

// Process jobs in parallel
verificationQueue.process(10, async (job) => {
  const { emails } = job.data;
  const verifier = new BatchVerifier();
  return await verifier.verifyBatch(emails);
});

// Add jobs for batch processing
export async function addToQueue(emails: string[]) {
  const chunks = chunkArray(emails, 100);
  
  for (const chunk of chunks) {
    await verificationQueue.add({ emails: chunk }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  }
}