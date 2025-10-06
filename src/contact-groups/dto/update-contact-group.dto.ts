import { PartialType } from '@nestjs/swagger';
import { CreateContactGroupDto } from './create-contact-group.dto';

export class UpdateContactGroupDto extends PartialType(CreateContactGroupDto) {}
