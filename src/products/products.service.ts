import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto, PaginationResult } from '../common/dto/pagination.dto';
import { InsuranceType } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto) {
    return this.prisma.product.create({
      data: createProductDto,
    });
  }

  async findAll(paginationDto: PaginationDto, type?: InsuranceType): Promise<PaginationResult<any>> {
    const { page, limit, search, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    let where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (type) {
      where.type = type;
    }

    const orderBy = sortBy ? { [sortBy]: sortOrder } : { createdAt: sortOrder };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: {
              clients: true,
              leadProducts: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            clients: true,
            leadProducts: true,
          },
        },
        clients: {
          take: 5,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            premium: true,
            startDate: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
  }

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getRecommendations(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        leadProducts: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const existingProductIds = lead.leadProducts.map(lp => lp.productId);

    const recommendations = await this.prisma.product.findMany({
      where: {
        type: lead.insuranceType,
        isActive: true,
        id: { notIn: existingProductIds },
      },
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      lead: {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        insuranceType: lead.insuranceType,
        budget: lead.budget,
      },
      recommendations,
      currentProducts: lead.leadProducts,
    };
  }

  async addToLead(leadId: string, productId: string, interest: number = 1, notes?: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.leadProduct.create({
      data: {
        leadId,
        productId,
        interest,
        notes,
      },
      include: {
        product: true,
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

  async getProductStats() {
    const [typeStats, totalProducts, activeProducts] = await Promise.all([
      this.prisma.product.groupBy({
        by: ['type'],
        _count: { id: true },
        where: { isActive: true },
      }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { isActive: true } }),
    ]);

    const popularProducts = await this.prisma.product.findMany({
      take: 5,
      orderBy: {
        clients: {
          _count: 'desc',
        },
      },
      include: {
        _count: {
          select: {
            clients: true,
            leadProducts: true,
          },
        },
      },
    });

    return {
      totalProducts,
      activeProducts,
      typeBreakdown: typeStats.reduce((acc, item) => {
        acc[item.type] = item._count.id;
        return acc;
      }, {}),
      popularProducts,
    };
  }
}