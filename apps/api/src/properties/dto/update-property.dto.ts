import { PartialType } from '@nestjs/swagger';
import { CreatePropertyDto } from './create-property.dto';

/**
 * All create fields, optional. PartialType re-applies the validators with
 * `@IsOptional`, so only the fields actually sent are validated and updated.
 */
export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}
