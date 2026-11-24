import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CompanyLookupService } from './company-lookup.service.js';
import { Company, CompanyParams } from './company-registry.dto.js';

@ApiTags('Company registry')
@Controller('company-registry')
export class CompanyRegistryController {
  constructor(private readonly companies: CompanyLookupService) {}

  @Get(':ico')
  @ApiOperation({
    summary: 'Look a company up in the public register by its number (IČO)',
    description:
      'Reads the Czech register ARES. The seller registration shows the answer before the seller confirms it.',
  })
  @ApiOkResponse({ type: Company })
  async find(@Param() params: CompanyParams): Promise<Company> {
    const { ico, legalName, legalForm, vatNumber, isVatPayer, address } = await this.companies.find(
      params.ico,
    );

    return { ico, legalName, legalForm, vatNumber, isVatPayer, address };
  }
}
