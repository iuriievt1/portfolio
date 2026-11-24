import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { VatLookupService } from './vat-lookup.service.js';
import { CheckedVatNumber, VatNumberParams } from './vat-registry.dto.js';

@ApiTags('VAT registry')
@Controller('vat-registry')
export class VatRegistryController {
  constructor(private readonly vatNumbers: VatLookupService) {}

  @Get(':countryCode/:number')
  @ApiOperation({
    summary: 'Check a VAT number of an EU country in the public register',
    description:
      'Asks VIES, the register of VAT numbers of the EU. The seller registration shows the answer ' +
      'before a company from another EU country is registered.',
  })
  @ApiOkResponse({ type: CheckedVatNumber })
  async find(@Param() params: VatNumberParams): Promise<CheckedVatNumber> {
    const { vatNumber, name, address } = await this.vatNumbers.find(
      params.countryCode,
      params.number,
    );

    return { vatNumber, name, address };
  }
}
