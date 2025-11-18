import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AutomationRuleService } from './automation-rule.service';
import {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from './dto/automation-rule.dto';

@Controller('whatsapp/automation-rules')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AutomationRuleController {
  constructor(private readonly ruleService: AutomationRuleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRule(
    @Request() req,
    @Body() createRuleDto: CreateAutomationRuleDto,
  ) {
    const userId = req.user.id;
    return this.ruleService.createRule(createRuleDto, userId);
  }

  @Get()
  async getRules(@Query('isActive') isActive?: string) {
    const options = isActive !== undefined ? { isActive: isActive === 'true' } : {};
    return this.ruleService.getRules(options);
  }

  @Get(':id')
  async getRule(@Param('id') ruleId: string) {
    return this.ruleService.getRule(ruleId);
  }

  @Patch(':id')
  async updateRule(
    @Request() req,
    @Param('id') ruleId: string,
    @Body() updateRuleDto: UpdateAutomationRuleDto,
  ) {
    const userId = req.user.id;
    return this.ruleService.updateRule(ruleId, updateRuleDto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(@Request() req, @Param('id') ruleId: string) {
    const userId = req.user.id;
    await this.ruleService.deleteRule(ruleId, userId);
  }

  @Get(':id/logs')
  async getExecutionLogs(
    @Param('id') ruleId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.ruleService.getExecutionLogs(ruleId, limitNum);
  }
}
