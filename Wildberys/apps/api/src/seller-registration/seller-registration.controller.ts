import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthContext } from '../auth/auth-context.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { maxDocumentBytes } from '../seller-documents/document-file.js';
import { documentRequired } from '../seller-documents/seller-document-errors.js';
import { AddDocumentBody } from '../seller-documents/seller-documents.dto.js';
import {
  ChoosePayoutMethodBody,
  DocumentParams,
  RegisterCompanyBody,
  RegisterEuCompanyBody,
  SaveBankAccountBody,
  SaveStoreBody,
  SellerRegistration,
  SubmitBody,
} from './seller-registration.dto.js';
import { ReportSellerChange } from './report-seller-change.js';
import { SellerRegistrationService } from './seller-registration.service.js';

const answer = { type: SellerRegistration, description: 'Where the registration stands now' };

const fileField = 'file';

/** The part of the uploaded file these routes use. The file is kept in memory. */
interface UploadedDocument {
  readonly buffer: Buffer;
}

/**
 * The registration of the signed-in person as a seller. There is no id in the addresses:
 * every route works with the seller this person registers, so nobody reaches the registration of another.
 */
@ApiTags('Seller registration')
@Controller('seller-registration')
@UseInterceptors(ReportSellerChange)
export class SellerRegistrationController {
  constructor(private readonly registration: SellerRegistrationService) {}

  @Get()
  @ApiOperation({ summary: 'Where the registration of this person as a seller stands' })
  @ApiOkResponse(answer)
  state(@CurrentAuth() auth: AuthContext): Promise<SellerRegistration> {
    return this.registration.state(auth);
  }

  @Put('company')
  @ApiOperation({
    summary: 'Step 2, a Czech company: register it by its number (IČO)',
    description:
      'The name, the legal form, the tax number and the address are read from the public register. ' +
      'Needs an account with a password and a confirmed phone number. Sent again, it replaces the company of the draft.',
  })
  @ApiOkResponse(answer)
  registerCompany(
    @CurrentAuth() auth: AuthContext,
    @Body() body: RegisterCompanyBody,
  ): Promise<SellerRegistration> {
    return this.registration.registerCompany(auth, body);
  }

  @Put('eu-company')
  @ApiOperation({
    summary: 'Step 2, a company from another EU country: register it by its VAT number',
    description:
      'The VAT number is checked in the register of VAT numbers of the EU, and the name comes from there ' +
      'when its country shares it. The seller writes the rest. A number the register calls not valid is refused. ' +
      'A trader without a VAT number, and a company whose register does not answer, are taken without that check, ' +
      'and the team checks their documents. ' +
      'Needs an account with a password and a confirmed phone number. Sent again, it replaces the company of the draft.',
  })
  @ApiOkResponse(answer)
  registerEuCompany(
    @CurrentAuth() auth: AuthContext,
    @Body() body: RegisterEuCompanyBody,
  ): Promise<SellerRegistration> {
    return this.registration.registerEuCompany(auth, body);
  }

  @Post('documents')
  @HttpCode(HttpStatus.OK)
  // The file is kept in memory: it is small, and it goes to the storage right away.
  @UseInterceptors(FileInterceptor(fileField, { limits: { fileSize: maxDocumentBytes, files: 1 } }))
  @ApiOperation({
    summary: 'Add a document to the registration',
    description:
      'Takes a PDF, a JPEG or a PNG of up to 10 MB. Before the registration is sent, and again when the team asked for documents. ' +
      'Only the team reads the file.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [fileField, 'kind', 'fileName'],
      properties: {
        [fileField]: { type: 'string', format: 'binary' },
        kind: { type: 'string', enum: ['IDENTITY_DOCUMENT', 'REGISTER_EXTRACT', 'OTHER'] },
        fileName: { type: 'string' },
      },
    },
  })
  @ApiOkResponse(answer)
  addDocument(
    @CurrentAuth() auth: AuthContext,
    @Body() body: AddDocumentBody,
    @UploadedFile() file: UploadedDocument | undefined,
  ): Promise<SellerRegistration> {
    if (!file) {
      throw documentRequired(fileField);
    }

    return this.registration.addDocument(auth, body.kind, body.fileName, file.buffer);
  }

  @Delete('documents/:documentId')
  @ApiOperation({
    summary: 'Delete a document of the registration',
    description: 'Before the registration is sent, and while the team waits for documents.',
  })
  @ApiOkResponse(answer)
  removeDocument(
    @CurrentAuth() auth: AuthContext,
    @Param() params: DocumentParams,
  ): Promise<SellerRegistration> {
    return this.registration.removeDocument(auth, params.documentId);
  }

  @Put('payout-method')
  @ApiOperation({
    summary: 'Step 3: choose how to be paid, through a Stripe account or to a bank account',
    description:
      'Opens an account at the payment provider. Another choice opens a new one, and the form of the provider starts again.',
  })
  @ApiOkResponse(answer)
  choosePayoutMethod(
    @CurrentAuth() auth: AuthContext,
    @Body() body: ChoosePayoutMethodBody,
  ): Promise<SellerRegistration> {
    return this.registration.choosePayoutMethod(auth, body.method);
  }

  @Put('bank-account')
  @ApiOperation({
    summary: 'Step 3, paid to a bank account: the account the payouts go to',
    description:
      'The number goes to the payment provider. Bluberi keeps its country and its last four characters.',
  })
  @ApiOkResponse(answer)
  saveBankAccount(
    @CurrentAuth() auth: AuthContext,
    @Body() body: SaveBankAccountBody,
  ): Promise<SellerRegistration> {
    return this.registration.saveBankAccount(auth, body);
  }

  @Post('payout-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 3: the seller finished the form of the payment provider',
    description: 'The check of the provider starts. The answer says where it stands.',
  })
  @ApiOkResponse(answer)
  finishPayoutForm(@CurrentAuth() auth: AuthContext): Promise<SellerRegistration> {
    return this.registration.finishPayoutForm(auth);
  }

  @Put('store')
  @ApiOperation({ summary: 'Step 4: the name of the store, its logo and where goods come back' })
  @ApiOkResponse(answer)
  saveStore(
    @CurrentAuth() auth: AuthContext,
    @Body() body: SaveStoreBody,
  ): Promise<SellerRegistration> {
    return this.registration.saveStore(auth, body);
  }

  @Post('submission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send the finished registration to Bluberi',
    description:
      'Needs a finished payout form, a store and the documents the registration lists as required. ' +
      'The owner promises to offer only goods that comply with the law of the EU. ' +
      'After it only the documents can change, when the team asks for them.',
  })
  @ApiOkResponse(answer)
  submit(
    @CurrentAuth() auth: AuthContext,
    @Body() promise: SubmitBody,
  ): Promise<SellerRegistration> {
    return this.registration.submit(auth, promise);
  }

  @Post('resubmission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send the registration back to Bluberi after a request for documents',
    description: 'For a seller the team asked for documents. The check of the team starts again.',
  })
  @ApiOkResponse(answer)
  resubmit(@CurrentAuth() auth: AuthContext): Promise<SellerRegistration> {
    return this.registration.resubmit(auth);
  }
}
