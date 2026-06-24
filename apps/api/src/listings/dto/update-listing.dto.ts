import { PartialType } from '@nestjs/swagger';
import { CreateListingDto } from './create-listing.dto';

/** All listing fields optional; the merged result is validated in the service. */
export class UpdateListingDto extends PartialType(CreateListingDto) {}
