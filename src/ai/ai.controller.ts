import { Controller, Post, Get, Put, Body, Param, Query, UseGuards, UseInterceptors, UploadedFiles, Delete, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('AI')
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Public()
  @Post('chatbot')
  @ApiOperation({ summary: 'Get chatbot response' })
  @ApiResponse({ status: 201, description: 'Chatbot response generated' })
  async chatbotResponse(
    @Body('input') input: string,
    @Body('leadId') leadId?: string,
  ) {
    return this.aiService.chatbotResponse(input, leadId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('auto-response/:leadId')
  @ApiOperation({ summary: 'Generate auto response for lead' })
  async generateAutoResponse(
    @Param('leadId') leadId: string,
    @Body('input') input: string,
  ) {
    return this.aiService.generateAutoResponse(leadId, input);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('sentiment/:leadId')
  @ApiOperation({ summary: 'Analyze sentiment of text' })
  async analyzeSentiment(
    @Param('leadId') leadId: string,
    @Body('text') text: string,
  ) {
    return this.aiService.analyzeSentiment(leadId, text);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('conversations')
  @ApiOperation({ summary: 'Get AI conversations' })
  async getConversations(@Query('leadId') leadId?: string) {
    return this.aiService.getAIConversations(leadId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('escalate/:conversationId')
  @ApiOperation({ summary: 'Escalate AI conversation to human' })
  async escalateToHuman(
    @Param('conversationId') conversationId: string,
    @Body('reason') reason: string,
  ) {
    return this.aiService.escalateToHuman(conversationId, reason);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('training/upload')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiOperation({ summary: 'Upload files for AI training' })
  async uploadTrainingFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('instructions') instructions: string,
  ) {
    return this.aiService.uploadTrainingFiles(files, instructions);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('training/scan-url')
  @ApiOperation({ summary: 'Scan URL for AI training' })
  async scanUrl(
    @Body('url') url: string,
    @Body('instructions') instructions: string,
  ) {
    return this.aiService.scanUrl(url, instructions);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('training/submit')
  @ApiOperation({ summary: 'Submit training instructions with URLs' })
  async submitTraining(
    @Body('instructions') instructions: string,
    @Body('urls') urls: string[],
  ) {
    return this.aiService.submitTraining(instructions, urls);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('training/test')
  @ApiOperation({ summary: 'Test AI with trained knowledge' })
  async testAi(@Body('message') message: string) {
    return this.aiService.testAi(message);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('training/data')
  @ApiOperation({ summary: 'Get all training data' })
  async getTrainingData() {
    return this.aiService.getTrainingData();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('training/data/:id')
  @ApiOperation({ summary: 'Delete training data' })
  async deleteTrainingData(@Param('id') id: string) {
    return this.aiService.deleteTrainingData(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('training/reprocess-pdfs')
  @ApiOperation({ summary: 'Check for PDFs that need reprocessing' })
  async reprocessPdfs() {
    return this.aiService.reprocessPdfTrainingData();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('widget/config/settings')
  @ApiOperation({ summary: 'Save widget configuration' })
  async saveWidgetConfig(@Body() config: {
    widgetId?: string;
    title: string;
    greeting: string;
    themeColor: string;
    position: string;
    profileIcon: string;
  }) {
    return this.aiService.saveWidgetConfig(config);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('widget/config/settings')
  @ApiOperation({ summary: 'Get current widget configuration' })
  async getCurrentWidgetConfig() {
    return this.aiService.getWidgetConfig('default');
  }

  @Public()
  @Post('widget/chat')
  @ApiOperation({ summary: 'Handle widget chat message' })
  async widgetChat(
    @Body() body: {
      message: string;
      conversationId: string;
      widgetId?: string;
      widgetToken: string; // REQUIRED: Signed token for tenant verification
      url?: string;
      domain?: string;
      userInfo?: { name?: string; email?: string; phone?: string };
    }
  ) {
    return this.aiService.handleWidgetChat(
      body.message,
      body.conversationId,
      body.widgetId,
      body.widgetToken,
      body.url,
      body.domain,
      body.userInfo
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('widget/conversations')
  @ApiOperation({ summary: 'Get all widget chat conversations' })
  async getWidgetConversations(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.aiService.getWidgetConversations(+page, +limit);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('widget/conversations/:conversationId')
  @ApiOperation({ summary: 'Get specific widget conversation with messages' })
  async getWidgetConversation(@Param('conversationId') conversationId: string) {
    return this.aiService.getWidgetConversation(conversationId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('widget/conversations/:conversationId/takeover')
  @ApiOperation({ summary: 'Take over widget conversation from AI' })
  async takeoverConversation(
    @Param('conversationId') conversationId: string,
    @Body() data: { reason?: string },
    @CurrentUser() user: any,
  ) {
    return this.aiService.takeoverWidgetConversation(conversationId, user.id, data.reason);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('widget/conversations/:conversationId/message')
  @ApiOperation({ summary: 'Send message in widget conversation as human agent' })
  async sendWidgetMessage(
    @Param('conversationId') conversationId: string,
    @Body() data: { message: string },
    @CurrentUser() user: any,
  ) {
    return this.aiService.sendWidgetMessage(conversationId, data.message, user);
  }

  @Public()
  @Get('widget/config/:widgetId')
  @ApiOperation({ summary: 'Get widget configuration' })
  async getWidgetConfig(@Param('widgetId') widgetId: string) {
    return this.aiService.getWidgetConfig(widgetId);
  }

  @Public()
  @Get('widget/script')
  @ApiOperation({ summary: 'Get widget JavaScript file as fallback' })
  async getWidgetScript(@Res() res: any) {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const widgetPath = path.join(process.cwd(), 'public', 'widget', 'chatbot-widget.js');
      
      if (!fs.existsSync(widgetPath)) {
        throw new Error(`Widget file not found at: ${widgetPath}`);
      }
      
      const widgetScript = fs.readFileSync(widgetPath, 'utf8');
      
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.send(widgetScript);
    } catch (error) {
      console.error('Widget script error:', error);
      res.status(404).json({
        error: 'Widget script not found',
        message: error.message || 'Please ensure the widget script is properly deployed',
        path: path.join(process.cwd(), 'public', 'widget', 'chatbot-widget.js')
      });
    }
  }

}