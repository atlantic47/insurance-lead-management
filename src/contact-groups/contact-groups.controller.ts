import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ContactGroupsService } from './contact-groups.service';
import { CreateContactGroupDto } from './dto/create-contact-group.dto';
import { UpdateContactGroupDto } from './dto/update-contact-group.dto';
import { AddLeadsToGroupDto } from './dto/add-leads-to-group.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Contact Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contact-groups')
export class ContactGroupsController {
  constructor(private readonly contactGroupsService: ContactGroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new contact group' })
  @ApiResponse({ status: 201, description: 'Contact group created successfully' })
  create(@Body() createDto: CreateContactGroupDto, @CurrentUser() user: any) {
    return this.contactGroupsService.create(createDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all contact groups' })
  @ApiResponse({ status: 200, description: 'Contact groups retrieved successfully' })
  findAll(@CurrentUser() user: any) {
    return this.contactGroupsService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contact group by ID' })
  @ApiResponse({ status: 200, description: 'Contact group found' })
  @ApiResponse({ status: 404, description: 'Contact group not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.contactGroupsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contact group' })
  @ApiResponse({ status: 200, description: 'Contact group updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateContactGroupDto,
    @CurrentUser() user: any,
  ) {
    return this.contactGroupsService.update(id, updateDto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete contact group' })
  @ApiResponse({ status: 200, description: 'Contact group deleted successfully' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.contactGroupsService.remove(id, user.id);
  }

  @Post(':id/leads')
  @ApiOperation({ summary: 'Add leads to contact group' })
  @ApiResponse({ status: 200, description: 'Leads added to group successfully' })
  addLeadsToGroup(
    @Param('id') id: string,
    @Body() dto: AddLeadsToGroupDto,
    @CurrentUser() user: any,
  ) {
    return this.contactGroupsService.addLeadsToGroup(id, dto, user.id);
  }

  @Delete(':groupId/leads/:leadId')
  @ApiOperation({ summary: 'Remove lead from contact group' })
  @ApiResponse({ status: 200, description: 'Lead removed from group successfully' })
  removeLeadFromGroup(
    @Param('groupId') groupId: string,
    @Param('leadId') leadId: string,
    @CurrentUser() user: any,
  ) {
    return this.contactGroupsService.removeLeadFromGroup(groupId, leadId, user.id);
  }

  @Get(':id/contacts')
  @ApiOperation({ summary: 'Get all contacts in a group' })
  @ApiResponse({ status: 200, description: 'Group contacts retrieved successfully' })
  getGroupContacts(@Param('id') id: string, @CurrentUser() user: any) {
    return this.contactGroupsService.getGroupContacts(id, user.id);
  }
}
