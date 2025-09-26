import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { AIService } from './ai/ai.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly aiService: AIService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Post('widget-chat')
  async widgetChat(@Body() body: {
    message: string;
    conversationId: string;
    widgetId?: string;
    url?: string;
    domain?: string;
  }) {
    try {
      // Use the AI service to handle the widget chat
      return await this.aiService.handleWidgetChat(
        body.message,
        body.conversationId,
        body.widgetId,
        body.url,
        body.domain
      );
    } catch (error) {
      console.error('Widget chat error:', error);
      return {
        response: 'I apologize, but I encountered an error. Please try again.',
        shouldEscalate: true,
        confidence: 0,
        intent: 'error'
      };
    }
  }
}
