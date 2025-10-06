import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { PaginationDto, PaginationResult } from '../common/dto/pagination.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(paginationDto: PaginationDto): Promise<PaginationResult<any>> {
    const { page, limit, search, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { email: { contains: search } },
            { policyNumber: { contains: search } },
          ],
        }
      : {};

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
    const client = await this.prisma.client.findUnique({
      where: { id },
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
    const client = await this.prisma.client.findUnique({ where: { id } });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

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
    const [totalClients, activeClients, renewalsThisMonth] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.client.count({ where: { isActive: true } }),
      this.prisma.client.count({
        where: {
          renewalDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
          },
        },
      }),
    ]);

    const productStats = await this.prisma.client.groupBy({
      by: ['productId'],
      _count: { id: true },
      where: { productId: { not: null } },
    });

    const totalPremiums = await this.prisma.client.aggregate({
      _sum: { premium: true },
      where: { isActive: true },
    });

    const totalCommissions = await this.prisma.client.aggregate({
      _sum: { commission: true },
      where: { isActive: true },
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
    const client = await this.prisma.client.findUnique({ where: { id } });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return this.prisma.client.update({
      where: { id },
      data: updateData,
    });
  }

  async getUpcomingRenewals(days: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.prisma.client.findMany({
      where: {
        renewalDate: {
          lte: futureDate,
          gte: new Date(),
        },
        isActive: true,
      },
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