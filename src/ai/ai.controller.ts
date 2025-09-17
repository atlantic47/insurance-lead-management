import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('AI')
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Public()
  @Post('chatbot')
  @ApiOperation({ summary: 'Get chatbot response' })
  @ApiResponse({ status: 201, description: 'Chatbot response generated' })
  chatbotResponse(
    @Body('input') input: string,
    @Body('leadId') leadId?: string,
  ) {
    return this.aiService.chatbotResponse(input, leadId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('auto-response/:leadId')
  @ApiOperation({ summary: 'Generate auto response for lead' })
  generateAutoResponse(
    @Param('leadId') leadId: string,
    @Body('input') input: string,
  ) {
    return this.aiService.generateAutoResponse(leadId, input);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('sentiment/:leadId')
  @ApiOperation({ summary: 'Analyze sentiment of text' })
  analyzeSentiment(
    @Param('leadId') leadId: string,
    @Body('text') text: string,
  ) {
    return this.aiService.analyzeSentiment(leadId, text);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('conversations')
  @ApiOperation({ summary: 'Get AI conversations' })
  getConversations(@Query('leadId') leadId?: string) {
    return this.aiService.getAIConversations(leadId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('escalate/:conversationId')
  @ApiOperation({ summary: 'Escalate AI conversation to human' })
  escalateToHuman(
    @Param('conversationId') conversationId: string,
    @Body('reason') reason: string,
  ) {
    return this.aiService.escalateToHuman(conversationId, reason);
  }
}