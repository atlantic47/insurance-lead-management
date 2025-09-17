import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, InsuranceType } from '@prisma/client';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all products with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: InsuranceType })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('type') type?: InsuranceType,
  ) {
    return this.productsService.findAll(paginationDto, type);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get product statistics' })
  @ApiResponse({ status: 200, description: 'Product statistics retrieved' })
  getStats() {
    return this.productsService.getProductStats();
  }

  @Get('recommendations/:leadId')
  @ApiOperation({ summary: 'Get product recommendations for a lead' })
  @ApiResponse({ status: 200, description: 'Product recommendations retrieved' })
  getRecommendations(@Param('leadId') leadId: string) {
    return this.productsService.getRecommendations(leadId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update product' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate product' })
  @ApiResponse({ status: 200, description: 'Product deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post(':productId/add-to-lead/:leadId')
  @ApiOperation({ summary: 'Add product to lead' })
  @ApiResponse({ status: 201, description: 'Product added to lead successfully' })
  addToLead(
    @Param('productId') productId: string,
    @Param('leadId') leadId: string,
    @Body('interest') interest?: number,
    @Body('notes') notes?: string,
  ) {
    return this.productsService.addToLead(leadId, productId, interest, notes);
  }
}