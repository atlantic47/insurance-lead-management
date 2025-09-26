import { Injectable, Logger } from '@nestjs/common';

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private jobs: Map<string, Job> = new Map();
  private processingJobs: Set<string> = new Set();
  private isProcessing = false;

  constructor() {
    this.startProcessing();
  }

  async addJob<T>(
    type: string,
    data: T,
    options: {
      delay?: number;
      maxAttempts?: number;
    } = {}
  ): Promise<string> {
    const jobId = `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const job: Job<T> = {
      id: jobId,
      type,
      data,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      createdAt: new Date(),
      processAt: new Date(Date.now() + (options.delay || 0)),
      status: 'pending',
    };

    this.jobs.set(jobId, job);
    this.logger.log(`Job added: ${jobId} (type: ${type})`);
    
    return jobId;
  }

  private async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.logger.log('Queue processing started');

    const processLoop = async () => {
      try {
        await this.processNextJob();
      } catch (error) {
        this.logger.error('Error in process loop:', error);
      }
      
      setTimeout(processLoop, 1000); // Check for jobs every second
    };

    processLoop();
  }

  private async processNextJob() {
    const now = new Date();
    
    // Find the next job to process
    const jobToProcess = Array.from(this.jobs.values())
      .filter(job => 
        job.status === 'pending' && 
        job.processAt <= now &&
        !this.processingJobs.has(job.id)
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

    if (!jobToProcess) return;

    this.processingJobs.add(jobToProcess.id);
    jobToProcess.status = 'processing';
    jobToProcess.attempts++;

    this.logger.log(`Processing job: ${jobToProcess.id} (attempt ${jobToProcess.attempts})`);

    try {
      await this.executeJob(jobToProcess);
      jobToProcess.status = 'completed';
      this.logger.log(`Job completed: ${jobToProcess.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      jobToProcess.error = errorMessage;
      
      if (jobToProcess.attempts >= jobToProcess.maxAttempts) {
        jobToProcess.status = 'failed';
        this.logger.error(`Job failed permanently: ${jobToProcess.id} - ${errorMessage}`);
      } else {
        jobToProcess.status = 'pending';
        jobToProcess.processAt = new Date(Date.now() + 5000 * jobToProcess.attempts); // Exponential backoff
        this.logger.warn(`Job failed, retrying: ${jobToProcess.id} - ${errorMessage}`);
      }
    } finally {
      this.processingJobs.delete(jobToProcess.id);
    }
  }

  // Method to register job processors
  private jobProcessors: Map<string, (job: Job) => Promise<void>> = new Map();

  registerProcessor(type: string, processor: (job: Job) => Promise<void>) {
    this.jobProcessors.set(type, processor);
    this.logger.log(`Registered processor for job type: ${type}`);
  }

  private async executeJob(job: Job) {
    const processor = this.jobProcessors.get(job.type);
    if (!processor) {
      throw new Error(`No processor registered for job type: ${job.type}`);
    }
    await processor(job);
  }


  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  // Clean up old completed/failed jobs
  cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000) { // 24 hours default
    const cutoffTime = new Date(Date.now() - maxAge);
    const jobsToRemove: string[] = [];

    this.jobs.forEach((job, jobId) => {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.createdAt < cutoffTime
      ) {
        jobsToRemove.push(jobId);
      }
    });

    jobsToRemove.forEach(jobId => {
      this.jobs.delete(jobId);
    });

    if (jobsToRemove.length > 0) {
      this.logger.log(`Cleaned up ${jobsToRemove.length} old jobs`);
    }
  }

  clearAllJobs(): void {
    const jobCount = this.jobs.size;
    this.jobs.clear();
    this.processingJobs.clear();
    this.logger.log(`Cleared all ${jobCount} jobs from queue`);
  }

  getJobStats(): { total: number; pending: number; processing: number; completed: number; failed: number } {
    const stats = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
    
    this.jobs.forEach(job => {
      stats.total++;
      stats[job.status]++;
    });
    
    return stats;
  }
}