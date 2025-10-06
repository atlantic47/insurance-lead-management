import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/services/prisma.service';
import { OpenAIService } from './openai.service';
import { LeadSource, LeadStatus, InsuranceType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';

@Injectable()
export class AIService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private openaiService: OpenAIService,
  ) {}

  async generateAutoResponse(leadId: string, input: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Placeholder AI integration - replace with actual AI service
    const mockResponse = this.generateMockResponse(input, lead);

    const aiConversation = await this.prisma.aIConversation.create({
      data: {
        type: 'AUTO_RESPONSE',
        input,
        output: mockResponse,
        confidence: 0.85,
        leadId,
        metadata: {
          timestamp: new Date(),
          model: 'mock-ai-v1',
        },
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return aiConversation;
  }

  async analyzeSentiment(leadId: string, text: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Mock sentiment analysis - replace with actual AI service
    const sentiment = this.mockSentimentAnalysis(text);

    const aiConversation = await this.prisma.aIConversation.create({
      data: {
        type: 'SENTIMENT_ANALYSIS',
        input: text,
        output: JSON.stringify(sentiment),
        confidence: sentiment.confidence,
        leadId,
        metadata: {
          timestamp: new Date(),
          analysis: sentiment,
        },
      },
    });

    return {
      sentiment,
      conversation: aiConversation,
    };
  }

  async chatbotResponse(input: string, leadId?: string) {
    try {
      // Get all processed training data
      const trainingData = await this.prisma.aITrainingData.findMany({
        where: { status: 'processed' },
        select: { content: true, instructions: true, name: true },
        orderBy: { createdAt: 'desc' },
      });

      // Build context from training data
      const context = trainingData.length > 0
        ? `KNOWLEDGE BASE (${trainingData.length} sources):\n\n` +
          trainingData.map((data, index) =>
            `=== SOURCE ${index + 1}: ${data.name || 'Training Data'} ===\n${data.content}`
          ).join('\n\n')
        : '';

      console.log(`🤖 Chatbot - Found ${trainingData.length} training sources`);

      // Get lead info if available
      let customerName = 'Customer';
      if (leadId) {
        const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
        if (lead) {
          customerName = `${lead.firstName} ${lead.lastName}`;
        }
      }

      // Generate response using OpenAI with training context
      const aiResponse = await this.openaiService.generateResponse(
        input,
        customerName,
        [],
        context
      );

      const aiConversation = await this.prisma.aIConversation.create({
        data: {
          type: 'CHATBOT',
          input,
          output: aiResponse.response,
          confidence: aiResponse.confidence,
          leadId,
          metadata: {
            timestamp: new Date(),
            channel: 'web-chat',
            usedTrainingData: trainingData.length > 0,
            trainingSourcesUsed: trainingData.length,
            shouldEscalate: aiResponse.shouldEscalate,
          },
        },
      });

      return {
        response: aiResponse.response,
        message: aiResponse.message,
        shouldEscalate: aiResponse.shouldEscalate,
        confidence: aiResponse.confidence,
        conversation: aiConversation,
      };
    } catch (error) {
      console.error('Error in chatbot response:', error);
      return {
        response: 'I apologize, but I encountered an error. Please try again or contact our support team.',
        message: 'I apologize, but I encountered an error. Please try again or contact our support team.',
        shouldEscalate: true,
        confidence: 0.1,
      };
    }
  }

  async getAIConversations(leadId?: string) {
    const where = leadId ? { leadId } : {};

    return this.prisma.aIConversation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async escalateToHuman(conversationId: string, reason: string) {
    // This would typically create a task or notification for human intervention
    const conversation = await this.prisma.aIConversation.findUnique({
      where: { id: conversationId },
      include: { lead: true },
    });

    if (!conversation) {
      throw new NotFoundException('AI conversation not found');
    }

    // Create a task for human follow-up
    if (conversation.leadId) {
      await this.prisma.task.create({
        data: {
          title: 'AI Escalation: Human Review Required',
          description: `Reason: ${reason}\nOriginal Input: ${conversation.input}`,
          type: 'FOLLOW_UP',
          priority: 4,
          leadId: conversation.leadId,
          assignedUserId: conversation.lead?.assignedUserId || '',
        },
      });
    }

    return {
      message: 'Escalated to human agent successfully',
      taskCreated: true,
    };
  }

  private generateMockResponse(input: string, lead: any): string {
    const responses = [
      `Hi ${lead.firstName}, thank you for your interest in ${lead.insuranceType.toLowerCase()} insurance. I'd be happy to help you with your inquiry.`,
      `Hello ${lead.firstName}, I understand you're looking for ${lead.insuranceType.toLowerCase()} coverage. Let me provide you with some information.`,
      `Thank you for reaching out! Based on your inquiry about ${lead.insuranceType.toLowerCase()} insurance, I can help you find the right coverage.`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private mockSentimentAnalysis(text: string) {
    const positive = ['great', 'excellent', 'good', 'happy', 'satisfied', 'love'];
    const negative = ['bad', 'terrible', 'awful', 'hate', 'disappointed', 'frustrated'];
    
    let score = 0.5; // neutral
    const words = text.toLowerCase().split(' ');
    
    words.forEach(word => {
      if (positive.some(p => word.includes(p))) score += 0.1;
      if (negative.some(n => word.includes(n))) score -= 0.1;
    });
    
    score = Math.max(0, Math.min(1, score));
    
    let sentiment = 'neutral';
    if (score > 0.6) sentiment = 'positive';
    if (score < 0.4) sentiment = 'negative';
    
    return {
      sentiment,
      score,
      confidence: 0.85,
    };
  }

  private generateChatbotResponse(input: string): string {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('price') || lowerInput.includes('cost') || lowerInput.includes('premium')) {
      return 'Insurance pricing depends on various factors. I can connect you with an agent who can provide a personalized quote based on your specific needs.';
    }
    
    if (lowerInput.includes('coverage') || lowerInput.includes('policy')) {
      return 'We offer comprehensive coverage options. What type of insurance are you interested in? Our agents can explain the different coverage levels available.';
    }
    
    if (lowerInput.includes('claim') || lowerInput.includes('file')) {
      return 'To file a claim, you can use our online portal or speak with one of our claims specialists. Would you like me to connect you with someone who can assist?';
    }
    
    return 'Thank you for your inquiry! I\'d be happy to help you learn more about our insurance products. Would you like to speak with one of our licensed agents?';
  }

  async uploadTrainingFiles(files: Express.Multer.File[], instructions: string) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const results: Array<{id?: string, name: string, status: string, error?: string}> = [];
    
    for (const file of files) {
      try {
        // Extract text from file based on type
        let content = '';
        const fileExtension = path.extname(file.originalname).toLowerCase();
        
        if (fileExtension === '.txt' || fileExtension === '.md') {
          content = file.buffer.toString('utf-8');
        } else if (fileExtension === '.pdf') {
          try {
            // Extract text from PDF using pdf-parse
            const pdfData = await pdfParse(file.buffer);
            content = pdfData.text;
            
            if (!content || content.trim().length === 0) {
              content = `PDF File: ${file.originalname}\nNote: This PDF file was uploaded but appears to be empty or contains only images/scanned content that cannot be extracted as text.`;
            } else {
              console.log(`✅ PDF extraction successful: ${content.length} characters extracted from ${file.originalname}`);
            }
          } catch (error) {
            console.error(`❌ PDF extraction failed for ${file.originalname}:`, error);
            content = `PDF File: ${file.originalname}\nNote: This PDF file could not be processed due to an error. It may be password-protected or corrupted.`;
          }
        } else if (fileExtension === '.xls' || fileExtension === '.xlsx' || fileExtension === '.csv') {
          try {
            // Parse Excel/CSV file
            const workbook = XLSX.read(file.buffer, { type: 'buffer' });
            let excelContent = `Excel/CSV File: ${file.originalname}\n\n`;
            
            // Process each worksheet
            workbook.SheetNames.forEach(sheetName => {
              const worksheet = workbook.Sheets[sheetName];
              excelContent += `Sheet: ${sheetName}\n`;
              excelContent += `====================\n`;
              
              // Convert to JSON to preserve structure and formulas
              const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
              
              // Format as readable text with formulas and calculations
              jsonData.forEach((row: any[], rowIndex) => {
                if (row.some(cell => cell !== '')) { // Skip empty rows
                  const formattedRow = row.map((cell, colIndex) => {
                    // Check if cell contains formula
                    const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
                    const originalCell = worksheet[cellRef];
                    
                    if (originalCell && originalCell.f) {
                      return `${cell} (Formula: =${originalCell.f})`;
                    }
                    return cell;
                  }).join(' | ');
                  excelContent += `Row ${rowIndex + 1}: ${formattedRow}\n`;
                }
              });
              excelContent += `\n`;
            });
            
            // Also get raw CSV format for better AI understanding
            const csvContent = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
            excelContent += `\nCSV Format:\n${csvContent}\n`;
            
            content = excelContent;
            console.log(`✅ Excel/CSV extraction successful: ${content.length} characters extracted from ${file.originalname}`);
          } catch (error) {
            console.error(`❌ Excel/CSV extraction failed for ${file.originalname}:`, error);
            content = `Excel/CSV File: ${file.originalname}\nNote: This file could not be processed due to an error. It may be corrupted or password-protected.`;
          }
        } else if (fileExtension === '.doc' || fileExtension === '.docx') {
          // For now, treat Word docs as text content that can be processed
          content = `Word Document: ${file.originalname}\nNote: This document contains important information that should be referenced when answering questions. Please inform users that detailed Word document extraction is not yet implemented, but the file has been noted for manual review.`;
        } else {
          throw new BadRequestException(`Unsupported file type: ${fileExtension}. Supported types: .txt, .md, .pdf, .doc, .docx, .xls, .xlsx, .csv`);
        }

        // Save training data to database
        const trainingData = await this.prisma.aITrainingData.create({
          data: {
            type: 'file',
            name: file.originalname,
            content,
            instructions,
            status: 'processing',
            metadata: {
              fileSize: file.size,
              fileType: file.mimetype,
              uploadedAt: new Date(),
            },
          },
        });

        // Process with OpenAI (async)
        this.processTrainingData(trainingData.id, content, instructions);
        
        results.push({
          id: trainingData.id,
          name: file.originalname,
          status: 'processing',
        });
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        results.push({
          name: file.originalname,
          status: 'error',
          error: error.message,
        });
      }
    }

    return { results, message: 'Files uploaded and processing started' };
  }

  async scanUrl(url: string, instructions: string) {
    try {
      // Validate URL
      new URL(url);
      
      // Fetch webpage content
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Training-Bot/1.0)',
        },
      });

      // Extract text content from HTML
      const $ = cheerio.load(response.data);
      
      // Remove script and style elements
      $('script, style, nav, footer, header').remove();
      
      // Extract main content
      let content = $('main, article, .content, #content, .post-content').text();
      if (!content.trim()) {
        content = $('body').text();
      }
      
      // Clean up whitespace
      content = content.replace(/\s+/g, ' ').trim();
      
      if (!content) {
        throw new BadRequestException('No content could be extracted from the URL');
      }

      // Save training data to database
      const trainingData = await this.prisma.aITrainingData.create({
        data: {
          type: 'url',
          name: url,
          content,
          instructions,
          status: 'processing',
          metadata: {
            url,
            scannedAt: new Date(),
            contentLength: content.length,
          },
        },
      });

      // Process with OpenAI (async)
      this.processTrainingData(trainingData.id, content, instructions);

      return {
        id: trainingData.id,
        url,
        status: 'processing',
        message: 'URL scanned and processing started',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to scan URL: ${error.message}`);
    }
  }

  async submitTraining(instructions: string, urls: string[] = []) {
    try {
      // Scan all provided URLs and collect content
      const urlContents: string[] = [];
      
      for (const url of urls) {
        try {
          // Fetch webpage content
          const response = await axios.get(url, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; AI-Training-Bot/1.0)',
            },
          });

          // Extract text content from HTML
          const $ = cheerio.load(response.data);
          
          // Remove script and style elements
          $('script, style, nav, footer, header').remove();
          
          // Extract main content
          let content = $('main, article, .content, #content, .post-content').text();
          if (!content.trim()) {
            content = $('body').text();
          }
          
          // Clean up whitespace
          content = content.replace(/\s+/g, ' ').trim();
          
          if (content) {
            urlContents.push(`URL: ${url}\nContent: ${content}`);
          }
        } catch (error) {
          console.error(`Error scanning URL ${url}:`, error);
          urlContents.push(`URL: ${url}\nError: Could not fetch content`);
        }
      }

      // Combine instructions with URL content
      const combinedContent = urls.length > 0 
        ? `${instructions}\n\nReferenced URLs:\n${urlContents.join('\n\n')}`
        : instructions;

      // Save training data to database
      const trainingData = await this.prisma.aITrainingData.create({
        data: {
          type: 'instructions',
          name: 'Training Instructions',
          content: combinedContent,
          instructions,
          status: 'processing',
          metadata: {
            urls,
            submittedAt: new Date(),
            urlCount: urls.length,
          },
        },
      });

      // Process with OpenAI (async)
      this.processTrainingData(trainingData.id, combinedContent, instructions);

      return {
        id: trainingData.id,
        message: 'Training instructions submitted successfully',
        urlsProcessed: urls.length,
        status: 'processing',
      };
    } catch (error) {
      throw new BadRequestException(`Failed to submit training: ${error.message}`);
    }
  }

  async testAi(message: string) {
    try {
      // Get all processed training data
      const trainingData = await this.prisma.aITrainingData.findMany({
        where: { status: 'processed' },
        select: { content: true, instructions: true, name: true },
        orderBy: { createdAt: 'desc' },
      });

      // Build context from training data - use the processed content
      const context = trainingData.length > 0 
        ? `KNOWLEDGE BASE (${trainingData.length} sources):\n\n` + 
          trainingData.map((data, index) => 
            `=== SOURCE ${index + 1}: ${data.name || 'Training Data'} ===\n${data.content}`
          ).join('\n\n')
        : '';

      console.log(`🧠 AI Test - Found ${trainingData.length} training sources`);
      if (trainingData.length > 0) {
        console.log('📚 Training sources:', trainingData.map(d => d.name).join(', '));
        console.log('📖 Context length:', context.length, 'characters');
      }

      // Generate response using OpenAI with training context
      const response = await this.openaiService.generateResponse(
        message,
        'AI Assistant',
        [],
        context
      );

      console.log('🤖 AI Response generated:', response.response.substring(0, 100) + '...');

      return {
        response: response.response,
        confidence: response.confidence,
        usedTrainingData: trainingData.length > 0,
        trainingSourcesUsed: trainingData.length,
        sourcesAvailable: trainingData.map(d => d.name || 'Unnamed source'),
      };
    } catch (error) {
      console.error('Error testing AI:', error);
      return {
        response: 'I apologize, but I encountered an error while processing your request. Please try again.',
        confidence: 0.1,
        error: error.message,
      };
    }
  }

  async getTrainingData() {
    const data = await this.prisma.aITrainingData.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        name: true,
        instructions: true,
        status: true,
        createdAt: true,
        metadata: true,
      },
    });

    return { data };
  }

  async deleteTrainingData(id: string) {
    try {
      await this.prisma.aITrainingData.delete({
        where: { id },
      });
      return { message: 'Training data deleted successfully' };
    } catch (error) {
      throw new NotFoundException('Training data not found');
    }
  }

  async reprocessPdfTrainingData() {
    try {
      // Find PDF training data that might need reprocessing
      const pdfData = await this.prisma.aITrainingData.findMany({
        where: {
          type: 'file',
          name: { contains: '.pdf' },
          content: { contains: 'PDF content extraction not implemented yet' }
        }
      });

      console.log(`Found ${pdfData.length} PDF files that need reprocessing`);
      
      const results: Array<{id: string, name: string, status: string, message: string}> = [];
      for (const data of pdfData) {
        results.push({
          id: data.id,
          name: data.name,
          status: 'needs_manual_reupload',
          message: 'Please re-upload this PDF file to extract the actual content'
        });
      }

      return { 
        message: `Found ${pdfData.length} PDFs that need re-uploading`,
        pdfsToReupload: results 
      };
    } catch (error) {
      console.error('Error checking for PDF reprocessing:', error);
      return { message: 'Error checking PDF files', error: error.message };
    }
  }

  async handleWidgetChat(
    message: string,
    conversationId: string,
    widgetId?: string,
    url?: string,
    domain?: string,
    userInfo?: { name?: string; email?: string; phone?: string }
  ) {
    try {
      console.log('🤖 Widget Chat - Message:', message);
      console.log('📝 Widget Chat - Conversation ID:', conversationId);

      // Get or create AI conversation record
      let conversation = await this.prisma.aIConversation.findFirst({
        where: {
          metadata: {
            path: ['conversationId'] as any,
            equals: conversationId,
          },
        },
        include: {
          chatMessages: {
            orderBy: { createdAt: 'asc' },
            take: 10, // Last 10 messages for context
          },
          lead: true,
        },
      });

      // Extract KYC information from the message or use provided userInfo
      const kycInfo = userInfo
        ? {
            hasPersonalInfo: !!(userInfo.name || userInfo.email || userInfo.phone),
            firstName: userInfo.name?.split(' ')[0],
            lastName: userInfo.name?.split(' ').slice(1).join(' '),
            email: userInfo.email,
            phone: userInfo.phone,
          }
        : await this.extractKYCInfo(message);

      // Get or create lead if KYC info is found
      let leadId: string | null = conversation?.leadId || null;
      let leadCreated = false;

      if (kycInfo.hasPersonalInfo && !leadId) {
        const lead = await this.createOrUpdateLeadFromKYC(conversationId, kycInfo, url, domain);
        leadId = lead.id;
        leadCreated = true;
        console.log('✅ Lead created:', lead.id);
      }

      // Create conversation if it doesn't exist
      if (!conversation) {
        conversation = await this.prisma.aIConversation.create({
          data: {
            type: 'WIDGET_CHAT',
            input: message,
            output: '',
            confidence: 0,
            leadId: leadId,
            metadata: {
              conversationId,
              widgetId: widgetId || 'default',
              url,
              domain,
              customerName: kycInfo.firstName || 'Widget User',
              createdAt: new Date(),
            },
          },
          include: {
            chatMessages: true,
            lead: true,
          },
        });
      } else {
        // Update conversation with leadId if we just created a lead
        if (leadCreated) {
          conversation = await this.prisma.aIConversation.update({
            where: { id: conversation.id },
            data: {
              leadId: leadId,
              metadata: {
                ...(conversation.metadata as any),
                leadId: leadId,
                customerName: kycInfo.firstName || (conversation.metadata as any).customerName,
              },
            },
            include: {
              chatMessages: true,
              lead: true,
            },
          });
        }
      }

      // Check if conversation is already escalated
      if (conversation.isEscalated) {
        // Save customer message
        await this.prisma.chatMessage.create({
          data: {
            content: message,
            sender: 'CUSTOMER',
            platform: 'WEBSITE',
            conversationId: conversation.id,
            leadId: leadId,
            metadata: { url, domain },
          },
        });

        return {
          response: "Thank you for your message. One of our specialists will respond to you shortly.",
          shouldEscalate: true,
          alreadyEscalated: true,
          confidence: 1.0,
          intent: 'human_handoff',
          leadCreated: leadCreated,
          leadId: leadId,
          conversationId: conversation.id,
          needsUserInfo: false,
        };
      }

      // Save customer message
      await this.prisma.chatMessage.create({
        data: {
          content: message,
          sender: 'CUSTOMER',
          platform: 'WEBSITE',
          conversationId: conversation.id,
          leadId: leadId,
          metadata: { url, domain, kycExtracted: kycInfo.hasPersonalInfo },
        },
      });

      // Get training data for context
      const trainingData = await this.prisma.aITrainingData.findMany({
        where: { status: 'processed' },
        select: { content: true, instructions: true, name: true },
        orderBy: { createdAt: 'desc' },
      });

      // Build context from training data
      const context = trainingData.length > 0
        ? `KNOWLEDGE BASE (${trainingData.length} sources):\n\n` +
          trainingData.map((data, index) =>
            `=== SOURCE ${index + 1}: ${data.name || 'Training Data'} ===\n${data.content}`
          ).join('\n\n')
        : '';

      // Build conversation history for context
      const conversationHistory = conversation.chatMessages?.map((msg: any) => msg.content) || [];

      // Generate response using OpenAI with training context
      const response = await this.openaiService.generateResponse(
        message,
        kycInfo.firstName || (conversation as any).lead?.firstName || 'Customer',
        conversationHistory,
        context
      );

      // Check if we should escalate
      const shouldEscalate = response.shouldEscalate || response.confidence < 0.5;
      const needsUserInfo = shouldEscalate && !kycInfo.hasPersonalInfo;

      // Save AI response message
      await this.prisma.chatMessage.create({
        data: {
          content: response.response,
          sender: 'AI_ASSISTANT',
          platform: 'WEBSITE',
          conversationId: conversation.id,
          leadId: leadId,
          metadata: {
            confidence: response.confidence,
            intent: response.intent,
            shouldEscalate,
          },
        },
      });

      // Update conversation
      await this.prisma.aIConversation.update({
        where: { id: conversation.id },
        data: {
          output: response.response,
          confidence: response.confidence,
          metadata: {
            ...(conversation.metadata as any),
            lastMessageAt: new Date(),
            messageCount: ((conversation as any).chatMessages?.length || 0) + 2,
          },
        },
      });

      return {
        response: response.response,
        shouldEscalate: shouldEscalate,
        needsUserInfo: needsUserInfo,
        confidence: response.confidence,
        intent: response.intent,
        leadCreated: leadCreated,
        leadId: leadId,
        conversationId: conversation.id,
        alreadyEscalated: false,
      };
    } catch (error) {
      console.error('Widget chat error:', error);
      return {
        response: 'I apologize, but I encountered an error. Please try again.',
        shouldEscalate: true,
        needsUserInfo: true,
        confidence: 0.1,
        leadCreated: false,
        conversationId: conversationId,
      };
    }
  }

  async getWidgetConfig(widgetId: string) {
    try {
      // Try to get saved widget config from database
      const savedConfig = await this.prisma.aITrainingData.findFirst({
        where: {
          type: 'widget_config',
          name: `widget_${widgetId}`,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (savedConfig && savedConfig.metadata) {
        const config = savedConfig.metadata as any;
        return {
          widgetId,
          title: config.title || 'Insurance Assistant',
          greeting: config.greeting || 'Hi! How can I help you with insurance today?',
          theme: config.theme || 'blue',
          themeColor: config.themeColor || '#0052cc',
          position: config.position || 'bottom-right',
          profileIcon: config.profileIcon || 'default',
          apiUrl: process.env.APP_URL || 'http://localhost:3001',
          allowedDomains: ['*'],
        };
      }
    } catch (error) {
      console.error('Error getting widget config:', error);
    }

    // Return default config if no saved config found
    return {
      widgetId,
      title: 'Insurance Assistant',
      greeting: 'Hi! How can I help you with insurance today?',
      theme: 'blue',
      themeColor: '#0052cc',
      position: 'bottom-right',
      profileIcon: 'default',
      apiUrl: process.env.APP_URL || 'http://localhost:3001/api',
      allowedDomains: ['*'],
    };
  }

  async saveWidgetConfig(config: {
    widgetId?: string;
    title: string;
    greeting: string;
    themeColor: string;
    position: string;
    profileIcon: string;
  }) {
    const widgetId = config.widgetId || 'default';
    
    try {
      // Helper function to convert hex to theme name for backward compatibility
      const getThemeFromColor = (hexColor: string) => {
        const colorMap: Record<string, string> = {
          '#0052cc': 'blue',
          '#2563eb': 'blue',
          '#059669': 'green',
          '#10b981': 'green',
          '#7c3aed': 'purple',
          '#8b5cf6': 'purple',
          '#dc2626': 'red',
          '#ef4444': 'red'
        };
        return colorMap[hexColor.toLowerCase()] || 'blue';
      };

      const configData = {
        ...config,
        theme: getThemeFromColor(config.themeColor),
        savedAt: new Date(),
      };

      // Check if widget configuration already exists
      const existingConfig = await this.prisma.aITrainingData.findFirst({
        where: {
          type: 'widget_config',
          name: `widget_${widgetId}`,
        },
      });

      if (existingConfig) {
        // Update existing configuration
        await this.prisma.aITrainingData.update({
          where: { id: existingConfig.id },
          data: {
            metadata: configData,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new configuration
        await this.prisma.aITrainingData.create({
          data: {
            type: 'widget_config',
            name: `widget_${widgetId}`,
            content: `Widget configuration for ${widgetId}`,
            instructions: 'Widget display settings',
            status: 'processed',
            metadata: configData,
          },
        });
      }

      return {
        success: true,
        message: 'Widget configuration saved successfully',
        config: await this.getWidgetConfig(widgetId),
      };
    } catch (error) {
      console.error('Error saving widget config:', error);
      throw new BadRequestException('Failed to save widget configuration');
    }
  }

  async getWidgetConversations(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.prisma.aIConversation.findMany({
        where: {
          type: 'WIDGET_CHAT',
        },
        skip,
        take: limit,
        include: {
          chatMessages: {
            orderBy: { createdAt: 'asc' },
          },
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.aIConversation.count({
        where: {
          type: 'WIDGET_CHAT',
        },
      }),
    ]);

    const formattedConversations = conversations.map((conv) => {
      const metadata = conv.metadata as any;
      const customerName = metadata?.customerName || conv.lead?.firstName || 'Widget User';

      return {
        id: conv.id,
        isEscalated: conv.isEscalated,
        escalatedAt: conv.escalatedAt,
        createdAt: conv.createdAt,
        lead: conv.lead || {
          id: metadata?.leadId || `temp_${conv.id}`,
          firstName: customerName,
          lastName: '',
          phone: metadata?.phone || '',
          email: metadata?.email || '',
          status: 'NEW' as any,
        },
        metadata: {
          widgetId: metadata?.widgetId,
          url: metadata?.url,
          domain: metadata?.domain,
          messageCount: metadata?.messageCount || conv.chatMessages?.length || 0,
          lastMessageAt: metadata?.lastMessageAt || conv.createdAt,
        },
        chatMessages: conv.chatMessages.map((msg) => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          platform: msg.platform,
          createdAt: msg.createdAt.toISOString(),
          isRead: msg.isRead,
        })),
      };
    });

    return {
      data: {
        conversations: formattedConversations,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getWidgetConversation(conversationId: string) {
    const conversation = await this.prisma.aIConversation.findFirst({
      where: {
        id: conversationId,
        type: 'WIDGET_CHAT',
      },
      include: {
        chatMessages: {
          orderBy: { createdAt: 'asc' },
        },
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const metadata = conversation.metadata as any;

    return {
      id: conversation.id,
      isEscalated: conversation.isEscalated,
      escalatedAt: conversation.escalatedAt,
      createdAt: conversation.createdAt,
      lead: conversation.lead || {
        id: metadata?.leadId || `temp_${conversation.id}`,
        firstName: metadata?.customerName || 'Widget User',
        lastName: '',
        phone: metadata?.phone || '',
        email: metadata?.email || '',
        status: 'NEW',
      },
      metadata: {
        widgetId: metadata?.widgetId,
        url: metadata?.url,
        domain: metadata?.domain,
      },
      chatMessages: conversation.chatMessages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        platform: msg.platform,
        createdAt: msg.createdAt.toISOString(),
        isRead: msg.isRead,
        metadata: msg.metadata,
      })),
    };
  }

  async takeoverWidgetConversation(conversationId: string, userId: string, reason?: string) {
    const conversation = await this.prisma.aIConversation.findUnique({
      where: { id: conversationId },
      include: { lead: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Escalate the conversation
    await this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: {
        isEscalated: true,
        escalatedAt: new Date(),
        userId: userId,
      },
    });

    // Create a system message
    await this.prisma.chatMessage.create({
      data: {
        content: `Conversation taken over by human agent. Reason: ${reason || 'Manual takeover'}`,
        sender: 'AI_ASSISTANT',
        platform: 'WEBSITE',
        conversationId: conversationId,
        leadId: conversation.leadId,
        metadata: {
          system: true,
          userId: userId,
          reason: reason,
          timestamp: new Date(),
        },
      },
    });

    return {
      success: true,
      message: 'Conversation taken over successfully',
      conversationId: conversationId,
      escalatedBy: userId,
    };
  }

  async sendWidgetMessage(conversationId: string, message: string, user: any) {
    const conversation = await this.prisma.aIConversation.findUnique({
      where: { id: conversationId },
      include: { lead: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Save human agent message
    await this.prisma.chatMessage.create({
      data: {
        content: message,
        sender: 'HUMAN_AGENT',
        platform: 'WEBSITE',
        conversationId: conversationId,
        leadId: conversation.leadId,
        metadata: {
          agentId: user.id,
          agentName: `${user.firstName} ${user.lastName}`,
          timestamp: new Date(),
        },
      },
    });

    return {
      success: true,
      message: 'Message sent successfully',
    };
  }

  private async processTrainingData(id: string, content: string, instructions: string) {
    try {
      // Process the content by cleaning and formatting it for OpenAI
      const processedContent = this.cleanAndFormatContent(content, instructions);
      
      // Update the training data with processed content and status
      await this.prisma.aITrainingData.update({
        where: { id },
        data: { 
          content: processedContent, // Store the processed version
          status: 'processed',
          processedAt: new Date(),
          metadata: {
            originalLength: content.length,
            processedLength: processedContent.length,
            processedAt: new Date(),
          }
        },
      });
      
      console.log(`Training data ${id} processed successfully - ${processedContent.length} characters`);
    } catch (error) {
      console.error(`Error processing training data ${id}:`, error);
      
      await this.prisma.aITrainingData.update({
        where: { id },
        data: { 
          status: 'error',
          error: error.message,
        },
      });
    }
  }

  private cleanAndFormatContent(content: string, instructions: string): string {
    // Clean up the content for better AI processing
    let cleaned = content
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();

    // Format for AI context
    return `TRAINING INSTRUCTIONS: ${instructions}

CONTENT TO LEARN FROM:
${cleaned}

---
This content should be used to answer related customer questions. When referencing this information, be specific and helpful.`;
  }

  // Extract KYC information from user message using OpenAI
  private async extractKYCInfo(message: string) {
    try {
      const prompt = `Extract personal information from this message for KYC purposes. Look for:
- First name and last name
- Email address
- Phone number  
- Address
- Date of birth
- Insurance type interest (auto, home, life, health, business)
- Any other relevant personal details

Message: "${message}"

Return JSON format:
{
  "hasPersonalInfo": boolean,
  "firstName": string or null,
  "lastName": string or null,
  "email": string or null,
  "phone": string or null,
  "address": string or null,
  "dateOfBirth": string or null,
  "insuranceType": string or null,
  "additionalInfo": string or null
}`;

      const response = await this.openaiService.generateResponse(
        prompt,
        'System',
        [],
        'You are a KYC information extractor. Return only valid JSON.'
      );

      try {
        const parsed = JSON.parse(response.response);
        return {
          hasPersonalInfo: parsed.hasPersonalInfo || false,
          firstName: parsed.firstName || null,
          lastName: parsed.lastName || null,
          email: parsed.email || null,
          phone: parsed.phone || null,
          address: parsed.address || null,
          dateOfBirth: parsed.dateOfBirth || null,
          insuranceType: parsed.insuranceType || null,
          additionalInfo: parsed.additionalInfo || null,
        };
      } catch (parseError) {
        // If JSON parsing fails, use basic regex extraction
        return this.extractKYCWithRegex(message);
      }
    } catch (error) {
      console.error('KYC extraction error:', error);
      return this.extractKYCWithRegex(message);
    }
  }

  // Fallback KYC extraction using regex patterns
  private extractKYCWithRegex(message: string) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
    const nameRegex = /(?:my name is|i'm|i am|call me)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i;
    
    const email = message.match(emailRegex)?.[0] || null;
    const phone = message.match(phoneRegex)?.[0] || null;
    const nameMatch = message.match(nameRegex);
    
    let firstName: string | null = null;
    let lastName: string | null = null;
    if (nameMatch) {
      const names = nameMatch[1].trim().split(' ');
      firstName = names[0];
      lastName = names.length > 1 ? names.slice(1).join(' ') : null;
    }
    
    const hasPersonalInfo = !!(email || phone || firstName);
    
    return {
      hasPersonalInfo,
      firstName,
      lastName,
      email,
      phone,
      address: null,
      dateOfBirth: null,
      insuranceType: null,
      additionalInfo: null,
    };
  }

  // Create or update lead based on extracted KYC information
  private async createOrUpdateLeadFromKYC(
    conversationId: string,
    kycInfo: any,
    url?: string,
    domain?: string
  ) {
    try {
      // Try to find existing lead by email or phone
      let existingLead: any = null;
      if (kycInfo.email) {
        existingLead = await this.prisma.lead.findFirst({
          where: { email: kycInfo.email }
        });
      }
      
      if (!existingLead && kycInfo.phone) {
        const cleanPhone = kycInfo.phone.replace(/\D/g, '');
        existingLead = await this.prisma.lead.findFirst({
          where: { 
            OR: [
              { phone: cleanPhone },
              { phone: kycInfo.phone },
              { alternatePhone: cleanPhone },
              { alternatePhone: kycInfo.phone },
            ]
          }
        });
      }

      const insuranceType = this.mapInsuranceType(kycInfo.insuranceType);
      
      if (existingLead) {
        // Update existing lead with new information
        const updateData: any = {
          updatedAt: new Date(),
        };
        
        if (kycInfo.firstName && !existingLead.firstName) updateData.firstName = kycInfo.firstName;
        if (kycInfo.lastName && !existingLead.lastName) updateData.lastName = kycInfo.lastName;
        if (kycInfo.email && !existingLead.email) updateData.email = kycInfo.email;
        if (kycInfo.phone && !existingLead.phone) updateData.phone = kycInfo.phone.replace(/\D/g, '');
        if (kycInfo.address && !existingLead.address) updateData.address = kycInfo.address;
        if (insuranceType && existingLead.insuranceType === InsuranceType.OTHER) updateData.insuranceType = insuranceType;
        
        // Update inquiry details with new information
        const additionalInfo = kycInfo.additionalInfo ? `\n\nAdditional info from chat widget: ${kycInfo.additionalInfo}` : '';
        updateData.inquiryDetails = (existingLead.inquiryDetails || '') + 
          `\n\nUpdated from AI widget chat (${new Date().toISOString()}): ` +
          `URL: ${url || 'unknown'}, Domain: ${domain || 'unknown'}${additionalInfo}`;

        return await this.prisma.lead.update({
          where: { id: existingLead.id },
          data: updateData
        });
      } else {
        // Create new lead
        const cleanPhone = kycInfo.phone ? kycInfo.phone.replace(/\D/g, '') : null;
        
        return await this.prisma.lead.create({
          data: {
            firstName: kycInfo.firstName || 'Widget',
            lastName: kycInfo.lastName || 'User',
            email: kycInfo.email || `widget_${conversationId}@temp.com`,
            phone: cleanPhone,
            address: kycInfo.address,
            source: LeadSource.WEBSITE,
            status: LeadStatus.NEW,
            insuranceType: insuranceType,
            inquiryDetails: `Auto-created from AI widget chat (${new Date().toISOString()})\n` +
              `Conversation ID: ${conversationId}\n` +
              `URL: ${url || 'unknown'}\n` +
              `Domain: ${domain || 'unknown'}\n` +
              `Extracted info: ${JSON.stringify(kycInfo, null, 2)}`,
            score: 75, // Higher score for widget leads with personal info
          }
        });
      }
    } catch (error) {
      console.error('Error creating/updating lead from KYC:', error);
      throw error;
    }
  }

  // Map insurance type string to enum
  private mapInsuranceType(insuranceTypeString: string | null): InsuranceType {
    if (!insuranceTypeString) return InsuranceType.OTHER;
    
    const lowerType = insuranceTypeString.toLowerCase();
    
    if (lowerType.includes('auto') || lowerType.includes('car') || lowerType.includes('vehicle')) {
      return InsuranceType.AUTO;
    }
    if (lowerType.includes('home') || lowerType.includes('house') || lowerType.includes('property')) {
      return InsuranceType.HOME;
    }
    if (lowerType.includes('life')) {
      return InsuranceType.LIFE;
    }
    if (lowerType.includes('health') || lowerType.includes('medical')) {
      return InsuranceType.HEALTH;
    }
    if (lowerType.includes('business') || lowerType.includes('commercial')) {
      return InsuranceType.BUSINESS;
    }
    
    return InsuranceType.OTHER;
  }
}