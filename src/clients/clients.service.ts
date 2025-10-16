import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { PaginationDto, PaginationResult } from '../common/dto/pagination.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(paginationDto: PaginationDto): Promise<PaginationResult<any>> {
    const { page, limit, search, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    let where: any = {};

    // Add tenant filter first
    where = this.prisma.addTenantFilter(where);

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { policyNumber: { contains: search } },
      ];
    }

    const orderBy = sortBy ? { [sortBy]: sortOrder } : { createdAt: sortOrder };

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          lead: {
            select: {
              id: true,
              source: true,
              createdAt: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: clients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }

  async create(createClientDto: any) {
    const { firstName, lastName, email, phone, policyNumber, premium, commission, startDate, renewalDate } = createClientDto;

    const client = await this.prisma.client.create({
      // @ts-ignore - tenantId added by Prisma middleware
      data: {
        firstName,
        lastName,
        email,
        phone,
        policyNumber,
        premium: premium || 0,
        commission: commission || 0,
        startDate: startDate ? new Date(startDate) : null,
        renewalDate: renewalDate ? new Date(renewalDate) : null,
        isActive: true,
      },
      include: {
        product: true,
        company: true,
      },
    });

    return {
      success: true,
      message: 'Client created successfully',
      data: client,
    };
  }

  async findOne(id: string) {
    let where: any = { id };

    // Add tenant filter
    where = this.prisma.addTenantFilter(where);

    const client = await this.prisma.client.findFirst({
      where,
      include: {
        lead: {
          include: {
            assignedUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            communications: {
              orderBy: { sentAt: 'desc' },
              take: 5,
            },
          },
        },
        product: true,
        company: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return {
      success: true,
      data: client,
    };
  }

  async update(id: string, updateClientDto: any) {
    // Validate tenant access
    await this.findOne(id);

    const { firstName, lastName, email, phone, policyNumber, premium, commission, startDate, renewalDate, isActive } = updateClientDto;

    const updatedClient = await this.prisma.client.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(policyNumber !== undefined && { policyNumber }),
        ...(premium !== undefined && { premium }),
        ...(commission !== undefined && { commission }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(renewalDate !== undefined && { renewalDate: renewalDate ? new Date(renewalDate) : null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        product: true,
        company: true,
      },
    });

    return {
      success: true,
      message: 'Client updated successfully',
      data: updatedClient,
    };
  }

  async getClientStats() {
    let baseWhere: any = {};
    baseWhere = this.prisma.addTenantFilter(baseWhere);

    let activeWhere: any = { isActive: true };
    activeWhere = this.prisma.addTenantFilter(activeWhere);

    let renewalWhere: any = {
      renewalDate: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
    };
    renewalWhere = this.prisma.addTenantFilter(renewalWhere);

    const [totalClients, activeClients, renewalsThisMonth] = await Promise.all([
      this.prisma.client.count({ where: baseWhere }),
      this.prisma.client.count({ where: activeWhere }),
      this.prisma.client.count({ where: renewalWhere }),
    ]);

    let productGroupWhere: any = { productId: { not: null } };
    productGroupWhere = this.prisma.addTenantFilter(productGroupWhere);

    const productStats = await this.prisma.client.groupBy({
      by: ['productId'],
      _count: { id: true },
      where: productGroupWhere,
    });

    const totalPremiums = await this.prisma.client.aggregate({
      _sum: { premium: true },
      where: activeWhere,
    });

    const totalCommissions = await this.prisma.client.aggregate({
      _sum: { commission: true },
      where: activeWhere,
    });

    return {
      totalClients,
      activeClients,
      renewalsThisMonth,
      totalPremiums: totalPremiums._sum.premium || 0,
      totalCommissions: totalCommissions._sum.commission || 0,
      productDistribution: productStats,
    };
  }

  async updatePolicy(id: string, updateData: any) {
    // Validate tenant access
    await this.findOne(id);

    return this.prisma.client.update({
      where: { id },
      data: updateData,
    });
  }

  async getUpcomingRenewals(days: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    let where: any = {
      renewalDate: {
        lte: futureDate,
        gte: new Date(),
      },
      isActive: true,
    };

    // Add tenant filter
    where = this.prisma.addTenantFilter(where);

    return this.prisma.client.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        lead: {
          select: {
            assignedUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { renewalDate: 'asc' },
    });
  }
}