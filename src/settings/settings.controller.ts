import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  @Get(':category')
  @ApiOperation({ summary: 'Get settings by category' })
  getSettingsByCategory(@Param('category') category: string) {
    return this.settingsService.getSettingsByCategory(category);
  }

  @Post('bulk-update')
  @ApiOperation({ summary: 'Update multiple settings' })
  updateMultipleSettings(@Body() settings: Array<{
    category: string;
    key: string;
    value: string;
    isEncrypted?: boolean;
    description?: string;
  }>) {
    return this.settingsService.updateMultipleSettings(settings);
  }
}
