export class VerificationQueue {
  private queue: { email: string; priority: number }[] = [];
  private processing = false;

  add(email: string, priority: number = 1) {
    this.queue.push({ email, priority });
    this.queue.sort((a, b) => b.priority - a.priority);
    this.process();
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const item = this.queue.shift();
    
    if (item) {
      // Process the email verification
      await this.verify(item.email);
    }
    
    this.processing = false;
    this.process();
  }

  private async verify(email: string) {
    // Simulate verification
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log(`Verified: ${email}`);
  }
}

export const verificationQueue = new VerificationQueue();