import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getTenantContext } from '../common/context/tenant-context';
import { CreateContactGroupDto } from './dto/create-contact-group.dto';
import { UpdateContactGroupDto } from './dto/update-contact-group.dto';
import { AddLeadsToGroupDto } from './dto/add-leads-to-group.dto';

@Injectable()
export class ContactGroupsService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateContactGroupDto, userId: string) {
    const { leadIds, ...groupData } = createDto;

    // Get tenant context
    const context = getTenantContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    const group = await this.prisma.contactGroup.create({
      data: {
        ...groupData,
        createdBy: {
          connect: { id: userId },
        },
        tenant: {
          connect: { id: tenantId },
        },
        ...(leadIds && leadIds.length > 0
          ? {
              leads: {
                create: leadIds.map(leadId => ({ leadId })),
              },
            }
          : {}),
      },
      include: {
        leads: {
          include: {
            lead: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                source: true,
              },
            },
          },
        },
        _count: {
          select: { leads: true },
        },
      },
    });

    return group;
  }

  async findAll(userId: string) {
    let where: any = { createdById: userId };

    // Add tenant filter
    where = this.prisma.addTenantFilter(where);

    return this.prisma.contactGroup.findMany({
      where,
      include: {
        _count: {
          select: { leads: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    let where: any = { id, createdById: userId };

    // Add tenant filter
    where = this.prisma.addTenantFilter(where);

    const group = await this.prisma.contactGroup.findFirst({
      where,
      include: {
        leads: {
          include: {
            lead: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                source: true,
                status: true,
                preferredContact: true,
              },
            },
          },
        },
        _count: {
          select: { leads: true },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Contact group not found');
    }

    return group;
  }

  async update(id: string, updateDto: UpdateContactGroupDto, userId: string) {
    await this.findOne(id, userId); // Check if exists

    const { leadIds, ...groupData } = updateDto;

    return this.prisma.contactGroup.update({
      where: { id },
      data: groupData,
      include: {
        _count: {
          select: { leads: true },
        },
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId); // Check if exists

    await this.prisma.contactGroup.delete({
      where: { id },
    });

    return { message: 'Contact group deleted successfully' };
  }

  async addLeadsToGroup(id: string, dto: AddLeadsToGroupDto, userId: string) {
    await this.findOne(id, userId); // Check if exists

    // Add leads that aren't already in the group
    const existingLeads = await this.prisma.leadContactGroup.findMany({
      where: {
        contactGroupId: id,
        leadId: { in: dto.leadIds },
      },
      select: { leadId: true },
    });

    const existingLeadIds = existingLeads.map((l) => l.leadId);
    const newLeadIds = dto.leadIds.filter((id) => !existingLeadIds.includes(id));

    if (newLeadIds.length > 0) {
      await this.prisma.leadContactGroup.createMany({
        data: newLeadIds.map((leadId) => ({
          leadId,
          contactGroupId: id,
        })),
      });
    }

    return this.findOne(id, userId);
  }

  async removeLeadFromGroup(groupId: string, leadId: string, userId: string) {
    await this.findOne(groupId, userId); // Check if exists

    await this.prisma.leadContactGroup.deleteMany({
      where: {
        contactGroupId: groupId,
        leadId,
      },
    });

    return { message: 'Lead removed from group successfully' };
  }

  async getGroupContacts(groupId: string, userId: string) {
    const group = await this.findOne(groupId, userId);

    return group.leads.map((lc) => lc.lead);
  }
}
