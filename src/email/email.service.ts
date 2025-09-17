import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { LeadSource, LeadStatus, InsuranceType } from '@prisma/client';

@Injectable()
export class EmailService {
  constructor(private prisma: PrismaService) {}

  async createOrGetLeadByEmail(email: string, name?: string) {
    // Check if lead exists by email
    let lead = await this.prisma.lead.findFirst({
      where: { email },
    });

    if (!lead) {
      // Create new lead from email
      const nameParts = name ? name.split(' ') : email.split('@')[0].split('.');
      lead = await this.prisma.lead.create({
        data: {
          firstName: nameParts[0] || 'Unknown',
          lastName: nameParts.slice(1).join(' ') || 'Contact',
          email,
          source: LeadSource.EMAIL,
          status: LeadStatus.NEW,
          insuranceType: InsuranceType.OTHER,
        },
      });
    }

    return lead;
  }

  async createEmailMessage(data: {
    subject: string;
    content: string;
    fromEmail: string;
    toEmail: string;
    ccEmails?: string[];
    bccEmails?: string[];
    messageId?: string;
    inReplyTo?: string;
    threadId?: string;
    direction: 'INBOUND' | 'OUTBOUND';
    leadId?: string;
  }) {
    return this.prisma.emailMessage.create({
      data: {
        ...data,
        ccEmails: data.ccEmails ? JSON.stringify(data.ccEmails) : undefined,
        bccEmails: data.bccEmails ? JSON.stringify(data.bccEmails) : undefined,
      },
    });
  }

  async getEmailsByLead(leadId: string) {
    return this.prisma.emailMessage.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllEmails(page = 1, limit = 20, filters?: {
    direction?: 'INBOUND' | 'OUTBOUND';
    isRead?: boolean;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (filters?.direction) where.direction = filters.direction;
    if (filters?.isRead !== undefined) where.isRead = filters.isRead;
    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = filters.fromDate;
      if (filters.toDate) where.createdAt.lte = filters.toDate;
    }

    const [emails, total] = await Promise.all([
      this.prisma.emailMessage.findMany({
        where,
        skip,
        take: limit,
        include: {
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.emailMessage.count({ where }),
    ]);

    return {
      emails,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEmailThread(threadId: string) {
    return this.prisma.emailMessage.findMany({
      where: { threadId },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getEmailThreads(page = 1, limit = 20, filters?: {
    leadId?: string;
    isRead?: boolean;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (filters?.leadId) where.leadId = filters.leadId;
    if (filters?.isRead !== undefined) where.isRead = filters.isRead;
    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = filters.fromDate;
      if (filters.toDate) where.createdAt.lte = filters.toDate;
    }

    // Get unique thread IDs with latest message info
    const threads = await this.prisma.emailMessage.groupBy({
      by: ['threadId'],
      where,
      _count: {
        id: true,
      },
      _max: {
        createdAt: true,
        subject: true,
      },
      _min: {
        createdAt: true,
      },
      orderBy: {
        _max: {
          createdAt: 'desc',
        },
      },
      skip,
      take: limit,
    });

    // Get full thread details
    const threadsWithDetails = await Promise.all(
      threads.map(async (thread) => {
        const messages = await this.getEmailThread(thread.threadId || 'unknown');
        const latestMessage = messages[messages.length - 1];
        const firstMessage = messages[0];
        
        return {
          threadId: thread.threadId,
          subject: thread._max.subject || 'No Subject',
          messageCount: thread._count.id,
          latestMessageAt: thread._max.createdAt,
          firstMessageAt: thread._min.createdAt,
          lead: latestMessage?.lead,
          latestMessage: latestMessage,
          firstMessage: firstMessage,
          unreadCount: messages.filter(msg => !msg.isRead && msg.direction === 'INBOUND').length,
          messages: messages,
        };
      })
    );

    const total = await this.prisma.emailMessage.groupBy({
      by: ['threadId'],
      where,
    });

    return {
      threads: threadsWithDetails,
      total: total.length,
      page,
      totalPages: Math.ceil(total.length / limit),
    };
  }

  async markEmailAsRead(emailId: string) {
    return this.prisma.emailMessage.update({
      where: { id: emailId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async sendEmailReply(data: {
    toEmail: string;
    subject: string;
    content: string;
    inReplyTo?: string;
    threadId?: string;
    leadId?: string;
    ccEmails?: string[];
    bccEmails?: string[];
  }) {
    // In production, this would integrate with an email service provider
    // like SendGrid, AWS SES, or similar
    
    console.log('Sending email reply:', data);

    let threadId = data.threadId;
    let subject = data.subject;

    // If this is a reply (inReplyTo is provided), find the original thread
    if (data.inReplyTo) {
      const originalEmail = await this.prisma.emailMessage.findFirst({
        where: { messageId: data.inReplyTo },
      });
      
      if (originalEmail && originalEmail.threadId) {
        threadId = originalEmail.threadId;
        // Add "Re: " prefix if not already present
        if (!subject.toLowerCase().startsWith('re:')) {
          subject = `Re: ${originalEmail.subject}`;
        }
      }
    }

    // If still no threadId, find existing thread for this lead and subject
    if (!threadId && data.leadId) {
      const existingEmail = await this.prisma.emailMessage.findFirst({
        where: {
          leadId: data.leadId,
          OR: [
            { subject: data.subject },
            { subject: subject },
            { subject: data.subject.replace(/^re:\s*/i, '') },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingEmail && existingEmail.threadId) {
        threadId = existingEmail.threadId;
      }
    }

    // Generate new threadId if still none
    if (!threadId) {
      const leadId = data.leadId || 'unknown';
      threadId = `thread_${leadId}_${Date.now()}`;
    }

    // Save the outbound email to database
    const emailMessage = await this.createEmailMessage({
      ...data,
      subject,
      threadId,
      fromEmail: process.env.COMPANY_EMAIL || 'noreply@insurance.com',
      direction: 'OUTBOUND',
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    });

    // Mock email sending - in production, send actual email here
    return {
      success: true,
      messageId: emailMessage.messageId,
      emailId: emailMessage.id,
      threadId: emailMessage.threadId,
    };
  }

  async handleIncomingEmail(data: {
    from: string;
    to: string;
    subject: string;
    content: string;
    messageId?: string;
    inReplyTo?: string;
    threadId?: string;
    cc?: string[];
    bcc?: string[];
  }) {
    // Extract sender name from email
    const senderName = this.extractNameFromEmail(data.from);
    
    // Create or get lead
    const lead = await this.createOrGetLeadByEmail(data.from, senderName);

    let threadId = data.threadId;
    const isReply = !!data.inReplyTo;

    // If this is a reply (inReplyTo is provided), find the original thread
    if (data.inReplyTo) {
      const originalEmail = await this.prisma.emailMessage.findFirst({
        where: { messageId: data.inReplyTo },
      });
      
      if (originalEmail && originalEmail.threadId) {
        threadId = originalEmail.threadId;
      }
    }

    // If still no threadId, try to find existing thread by subject and lead
    if (!threadId) {
      // Clean subject of "Re:", "Fwd:" etc. for better matching
      const cleanSubject = data.subject.replace(/^(re|fwd|fw):\s*/i, '').trim();
      
      const existingEmail = await this.prisma.emailMessage.findFirst({
        where: {
          leadId: lead.id,
          OR: [
            { subject: data.subject },
            { subject: cleanSubject },
            { subject: { contains: cleanSubject } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingEmail && existingEmail.threadId) {
        threadId = existingEmail.threadId;
      }
    }

    // Generate new thread ID if still none
    if (!threadId) {
      threadId = `thread_${lead.id}_${Date.now()}`;
    }

    // Save incoming email
    const emailMessage = await this.createEmailMessage({
      subject: data.subject,
      content: data.content,
      fromEmail: data.from,
      toEmail: data.to,
      messageId: data.messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      inReplyTo: data.inReplyTo,
      threadId,
      direction: 'INBOUND',
      leadId: lead.id,
      ccEmails: data.cc,
      bccEmails: data.bcc,
    });

    return {
      emailMessage,
      lead,
      threadId,
      isNewLead: !isReply,
      isReply,
    };
  }

  private extractNameFromEmail(email: string): string {
    // Extract name from "Name <email@domain.com>" format
    const match = email.match(/^(.+?)\s*<.+>$/);
    if (match) {
      return match[1].trim();
    }
    
    // Fallback: use part before @ symbol
    return email.split('@')[0].replace(/[._]/g, ' ');
  }

  async getEmailStats() {
    const [totalEmails, unreadEmails, todayEmails, inboundEmails] = await Promise.all([
      this.prisma.emailMessage.count(),
      this.prisma.emailMessage.count({ where: { isRead: false } }),
      this.prisma.emailMessage.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.emailMessage.count({ where: { direction: 'INBOUND' } }),
    ]);

    return {
      totalEmails,
      unreadEmails,
      todayEmails,
      inboundEmails,
      outboundEmails: totalEmails - inboundEmails,
    };
  }
}