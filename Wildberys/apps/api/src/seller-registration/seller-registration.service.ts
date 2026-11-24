import { Injectable } from '@nestjs/common';

import { AuditLogService } from '../audit/audit-log.service.js';
import type { AuthContext } from '../auth/auth-context.js';
import { CategoriesService } from '../categories/categories.service.js';
import { CompanyLookupService } from '../company-registry/company-lookup.service.js';
import type { RegistryAddress } from '../company-registry/company-registry.js';
import { isUniqueViolation } from '../database/prisma-errors.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  CompanyCheck,
  PayoutAccountStatus,
  SellerMemberRole,
  SellerStatus,
  type PayoutMethod,
  type SellerDocumentKind,
  type SellerLegalForm,
} from '../generated/prisma/enums.js';
import { imageKey } from '../images/images.service.js';
import { PayoutAccountsService } from '../payouts/payout-accounts.service.js';
import type { BankAccountDetails } from '../payouts/payout-provider.js';
import { SellerDocumentsService } from '../seller-documents/seller-documents.service.js';
import { documentStatuses, moveSeller, portalStatuses } from '../sellers/seller-status.js';
import { FileStorage } from '../storage/file-storage.js';
import { isPostalCodeOf } from '../validation/postal-code.js';
import { vatLetters } from '../vat-registry/eu-countries.js';
import { VatLookupService } from '../vat-registry/vat-lookup.service.js';
import { requiredDocumentKinds } from './required-documents.js';
import { homeCountry, sellerCountries } from './seller-countries.js';
import {
  accountNotReady,
  companyAlreadyRegistered,
  companyRequired,
  documentsNotRequested,
  documentsRequired,
  logoNotFound,
  registrationAlreadySubmitted,
  registrationIncomplete,
  returnPostalCodeInvalid,
  storeNameInvalid,
  storeNameTaken,
  vatNumberMissing,
} from './seller-registration-errors.js';
import type {
  RegisterCompanyBody,
  RegisterEuCompanyBody,
  RegistrationSeller,
  RegistrationStore,
  SaveStoreBody,
  SellerRegistration,
  SubmitBody,
} from './seller-registration.dto.js';
import { storeSlugMinLength, toStoreSlug } from './store-slug.js';

const sellerInclude = {
  registeredAddress: true,
  // The store of the registration is the first store of the seller.
  stores: {
    orderBy: { createdAt: 'asc' },
    take: 1,
    include: {
      returnAddress: true,
      logoImage: true,
      categories: { orderBy: { category: { slug: 'asc' } } },
    },
  },
} satisfies Prisma.SellerInclude;

type SellerWithStore = Prisma.SellerGetPayload<{ include: typeof sellerInclude }>;
type StoreOfSeller = SellerWithStore['stores'][number];

function ownedSellerId(auth: AuthContext): string | undefined {
  return auth.sellerMemberships.find(({ role }) => role === SellerMemberRole.OWNER)?.sellerId;
}

/** The company of a seller as it is saved, whichever register it was checked in. */
interface CompanyToSave {
  /** The country the company is registered in. */
  readonly countryCode: string;
  readonly registrationNumber: string;
  readonly legalName: string;
  readonly legalForm: SellerLegalForm;
  readonly vatNumber: string | null;
  readonly isVatPayer: boolean;
  /** Which register confirmed the company, if any did. */
  readonly companyCheck: CompanyCheck;
  /** The registered address. */
  readonly address: RegistryAddress;
}

/** What of a company is written into the seller. Its address is a record of its own. */
function companyData(company: CompanyToSave) {
  const { countryCode, registrationNumber, legalName, legalForm, vatNumber, isVatPayer } = company;

  return {
    countryCode,
    registrationNumber,
    legalName,
    legalForm,
    vatNumber,
    isVatPayer,
    companyCheck: company.companyCheck,
  };
}

/** The address of its own a store sends returned goods to. Undefined when they come back to the registered one. */
function ownReturnAddressId(seller: SellerWithStore): string | undefined {
  const returnAddressId = seller.stores[0]?.returnAddressId;

  return returnAddressId && returnAddressId !== seller.registeredAddressId
    ? returnAddressId
    : undefined;
}

/**
 * The registration of a seller: the company, how the seller is paid and the store.
 * A person registers one seller. Until it is sent to Bluberi it is a draft that its owner can change.
 */
@Injectable()
export class SellerRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompanyLookupService,
    private readonly vatNumbers: VatLookupService,
    private readonly categories: CategoriesService,
    private readonly payouts: PayoutAccountsService,
    private readonly documents: SellerDocumentsService,
    private readonly audit: AuditLogService,
    private readonly storage: FileStorage,
  ) {}

  /** Where the registration of this person stands. */
  state(auth: AuthContext): Promise<SellerRegistration> {
    return this.stateOf(auth, ownedSellerId(auth));
  }

  /**
   * Registers a Czech company by its number: everything else comes from the register,
   * so nobody types the name or the address of a company. Sent again, it replaces the company of the draft.
   */
  registerCompany(
    auth: AuthContext,
    { ico, isVatPayer }: RegisterCompanyBody,
  ): Promise<SellerRegistration> {
    return this.saveCompany(auth, async () => {
      const { legalName, legalForm, vatNumber, address } = await this.companies.find(ico);

      if (isVatPayer && vatNumber === null) {
        throw vatNumberMissing();
      }

      return {
        countryCode: homeCountry,
        registrationNumber: ico,
        legalName,
        legalForm,
        vatNumber,
        isVatPayer,
        companyCheck: CompanyCheck.COMPANY_REGISTER,
        address,
      };
    });
  }

  /**
   * Registers a company from another EU country. Its VAT number is checked in the register of VAT numbers,
   * which says little more than the name, so the seller writes the rest. A trader without a VAT number,
   * and a company whose register does not answer, are taken without that check: the team then checks
   * the documents of the seller. Sent again, it replaces the company of the draft.
   */
  registerEuCompany(
    auth: AuthContext,
    {
      countryCode,
      vatNumber,
      registrationNumber,
      legalName,
      legalForm,
      address,
    }: RegisterEuCompanyBody,
  ): Promise<SellerRegistration> {
    return this.saveCompany(auth, async () => {
      const record =
        vatNumber === null
          ? undefined
          : await this.vatNumbers.findIfAnswered(countryCode, vatNumber);

      return {
        countryCode,
        registrationNumber,
        // The name in the register stands above the one a person typed.
        legalName: record?.name ?? legalName,
        legalForm,
        // A number the register could not be asked about is kept as it was typed, for the team to check.
        vatNumber:
          record?.vatNumber ??
          (vatNumber === null ? null : `${vatLetters(countryCode)}${vatNumber}`),
        // The register lists the numbers of those who pay VAT.
        isVatPayer: vatNumber !== null,
        companyCheck: record ? CompanyCheck.VAT_REGISTER : CompanyCheck.DOCUMENTS,
        address: {
          street: address.street,
          city: address.city,
          postalCode: address.postalCode,
          countryCode,
        },
      };
    });
  }

  /** Adds a document to the registration: before it is sent, or when the team asked for one. */
  async addDocument(
    auth: AuthContext,
    kind: SellerDocumentKind,
    fileName: string,
    file: Buffer,
  ): Promise<SellerRegistration> {
    const seller = await this.sellerWithOpenDocuments(auth);

    await this.documents.add({
      sellerId: seller.id,
      uploadedById: auth.userId,
      kind,
      fileName,
      file,
    });

    return this.stateOf(auth, seller.id);
  }

  async removeDocument(auth: AuthContext, documentId: string): Promise<SellerRegistration> {
    const seller = await this.sellerWithOpenDocuments(auth);

    await this.documents.remove(seller.id, documentId, auth.userId);

    return this.stateOf(auth, seller.id);
  }

  async choosePayoutMethod(auth: AuthContext, method: PayoutMethod): Promise<SellerRegistration> {
    const seller = await this.ownDraft(auth);

    await this.payouts.chooseMethod(auth.userId, seller.id, method);

    return this.stateOf(auth, seller.id);
  }

  async saveBankAccount(
    auth: AuthContext,
    bankAccount: BankAccountDetails,
  ): Promise<SellerRegistration> {
    const seller = await this.ownDraft(auth);

    await this.payouts.saveBankAccount(auth.userId, seller.id, bankAccount);

    return this.stateOf(auth, seller.id);
  }

  /** The seller finished the form of the payment provider. */
  async finishPayoutForm(auth: AuthContext): Promise<SellerRegistration> {
    const seller = await this.ownDraft(auth);

    await this.payouts.finishForm(seller.id);

    return this.stateOf(auth, seller.id);
  }

  /** Sets up the store buyers will see: its name, its logo, what it sells and where goods come back. */
  async saveStore(
    auth: AuthContext,
    { name, logoImageId, categoryIds, returnAddress }: SaveStoreBody,
  ): Promise<SellerRegistration> {
    const seller = await this.ownDraft(auth);
    const slug = toStoreSlug(name);

    if (slug.length < storeSlugMinLength) {
      throw storeNameInvalid();
    }

    if (logoImageId !== null) {
      const logo = await this.prisma.image.findFirst({
        where: { id: logoImageId, uploadedById: auth.userId },
      });

      if (!logo) {
        throw logoNotFound();
      }
    }

    if (returnAddress && !isPostalCodeOf(seller.countryCode, returnAddress.postalCode)) {
      throw returnPostalCodeInvalid();
    }

    const soldCategoryIds = await this.categories.normalize(categoryIds);
    const [store] = seller.stores;
    // An address of its own, when the store has one. The registered address belongs to the seller.
    const ownAddressId = ownReturnAddressId(seller);

    try {
      await this.prisma.$transaction(async (transaction) => {
        let returnAddressId = seller.registeredAddressId;

        if (returnAddress) {
          const { street, city, postalCode } = returnAddress;

          if (ownAddressId) {
            await transaction.address.update({
              where: { id: ownAddressId },
              data: { street, city, postalCode },
            });
            returnAddressId = ownAddressId;
          } else {
            const address = await transaction.address.create({
              data: { street, city, postalCode, countryCode: seller.countryCode },
            });

            returnAddressId = address.id;
          }
        }

        const data = { name, slug, logoImageId, returnAddressId };

        const saved = store
          ? await transaction.store.update({ where: { id: store.id }, data })
          : await transaction.store.create({ data: { ...data, sellerId: seller.id } });

        await transaction.storeCategory.deleteMany({ where: { storeId: saved.id } });
        await transaction.storeCategory.createMany({
          data: soldCategoryIds.map((categoryId) => ({ storeId: saved.id, categoryId })),
        });

        if (!returnAddress && ownAddressId) {
          await transaction.address.delete({ where: { id: ownAddressId } });
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw storeNameTaken();
      }

      throw error;
    }

    return this.stateOf(auth, seller.id);
  }

  /**
   * Sends the finished registration to Bluberi, with the promise of the owner to offer only goods
   * that comply with the law of the EU. From here the team checks the seller.
   */
  async submit(auth: AuthContext, { selfCertified }: SubmitBody): Promise<SellerRegistration> {
    const seller = await this.ownDraft(auth);
    const payoutAccount = await this.payouts.find(seller.id);

    if (
      !payoutAccount ||
      payoutAccount.status === PayoutAccountStatus.INCOMPLETE ||
      seller.stores.length === 0
    ) {
      throw registrationIncomplete();
    }

    const given = new Set((await this.documents.list(seller.id)).map(({ kind }) => kind));
    const missing = requiredDocumentKinds(seller.countryCode).filter((kind) => !given.has(kind));

    if (missing.length > 0) {
      throw documentsRequired(missing);
    }

    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      const sent = await moveSeller(transaction, seller.id, 'submit', {
        submittedAt: now,
        // A registration without the promise is not sent: the database refuses it.
        selfCertifiedAt: selfCertified ? now : null,
      });

      if (!sent) {
        throw registrationAlreadySubmitted();
      }

      await this.audit.record(
        {
          action: 'seller.registration_submitted',
          actorId: auth.userId,
          target: { type: 'seller', id: seller.id },
        },
        transaction,
      );
    });

    return this.stateOf(auth, seller.id);
  }

  /** Sends the registration back to the team after the owner answered its request for documents. */
  async resubmit(auth: AuthContext): Promise<SellerRegistration> {
    const sellerId = ownedSellerId(auth);

    if (!sellerId) {
      throw companyRequired();
    }

    await this.prisma.$transaction(async (transaction) => {
      const sent = await moveSeller(transaction, sellerId, 'resubmit', {
        submittedAt: new Date(),
      });

      if (!sent) {
        throw documentsNotRequested();
      }

      await this.audit.record(
        {
          action: 'seller.registration_submitted',
          actorId: auth.userId,
          target: { type: 'seller', id: sellerId },
        },
        transaction,
      );
    });

    return this.stateOf(auth, sellerId);
  }

  /** The seller of this person while its documents can still change. */
  private async sellerWithOpenDocuments(auth: AuthContext): Promise<{ readonly id: string }> {
    const sellerId = ownedSellerId(auth);

    if (!sellerId) {
      throw companyRequired();
    }

    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      select: { id: true, status: true },
    });

    if (!documentStatuses.includes(seller.status)) {
      throw registrationAlreadySubmitted();
    }

    return seller;
  }

  /** The seller this person registers. The steps after the company need it. */
  private ownDraft(auth: AuthContext): Promise<SellerWithStore> {
    const sellerId = ownedSellerId(auth);

    if (!sellerId) {
      throw companyRequired();
    }

    return this.draft(sellerId);
  }

  private async draft(sellerId: string): Promise<SellerWithStore> {
    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      include: sellerInclude,
    });

    if (seller.status !== SellerStatus.DRAFT) {
      throw registrationAlreadySubmitted();
    }

    return seller;
  }

  /**
   * Saves the company a register confirmed: as a new seller, or in place of the company of the draft.
   * The register is asked only for an account that may register a company.
   */
  private async saveCompany(
    auth: AuthContext,
    find: () => Promise<CompanyToSave>,
  ): Promise<SellerRegistration> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });

    if (!user.phone || !user.phoneVerifiedAt || !user.passwordHash) {
      throw accountNotReady();
    }

    const sellerId = ownedSellerId(auth);
    const draft = sellerId ? await this.draft(sellerId) : undefined;
    const company = await find();

    // Abroad the register checks the VAT number and the registration number is only typed,
    // so there a VAT number belongs to one seller too. A trader without one has nothing to compare.
    if (company.countryCode !== homeCountry && company.vatNumber !== null) {
      const sellersWithNumber = await this.prisma.seller.count({
        where: { vatNumber: company.vatNumber, id: { not: draft?.id } },
      });

      if (sellersWithNumber > 0) {
        throw companyAlreadyRegistered();
      }
    }

    try {
      if (draft) {
        await this.replaceCompany(auth.userId, draft, company);

        return await this.stateOf(auth, draft.id);
      }

      const created = await this.prisma.$transaction(async (transaction) => {
        const seller = await transaction.seller.create({
          data: {
            ...companyData(company),
            contactEmail: user.email,
            contactPhone: user.phone ?? '',
            termsAcceptedAt: new Date(),
            registeredAddress: { create: company.address },
            members: { create: { userId: user.id, role: SellerMemberRole.OWNER } },
          },
        });

        await this.audit.record(
          {
            action: 'seller.registration_started',
            actorId: user.id,
            target: { type: 'seller', id: seller.id },
            details: {
              countryCode: company.countryCode,
              registrationNumber: company.registrationNumber,
            },
          },
          transaction,
        );

        return seller;
      });

      return await this.stateOf(auth, created.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw companyAlreadyRegistered();
      }

      throw error;
    }
  }

  private async replaceCompany(
    actorId: string,
    draft: SellerWithStore,
    company: CompanyToSave,
  ): Promise<void> {
    const anotherCountry = draft.countryCode !== company.countryCode;
    const anotherCompany =
      anotherCountry || draft.registrationNumber !== company.registrationNumber;
    // An address of its own was written for the country the seller had. In another country it leads nowhere.
    const strandedAddressId = anotherCountry ? ownReturnAddressId(draft) : undefined;

    await this.prisma.$transaction(async (transaction) => {
      await transaction.seller.update({
        where: { id: draft.id },
        data: { ...companyData(company), registeredAddress: { update: company.address } },
      });

      if (strandedAddressId) {
        await transaction.store.updateMany({
          where: { returnAddressId: strandedAddressId },
          data: { returnAddressId: draft.registeredAddressId },
        });
        await transaction.address.delete({ where: { id: strandedAddressId } });
      }

      if (anotherCompany) {
        await this.audit.record(
          {
            action: 'seller.registration_started',
            actorId,
            target: { type: 'seller', id: draft.id },
            details: {
              countryCode: company.countryCode,
              registrationNumber: company.registrationNumber,
            },
          },
          transaction,
        );
      }
    });

    if (anotherCompany) {
      // The payout account was opened for the first company. The seller chooses again for this one.
      await this.payouts.remove(draft.id);
    }
  }

  /**
   * The answer of every step. The id of the owned seller is passed in, because a seller made
   * in this request is not among the memberships the request started with.
   */
  private async stateOf(
    auth: AuthContext,
    sellerId: string | undefined,
  ): Promise<SellerRegistration> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    const seller = sellerId
      ? await this.prisma.seller.findUniqueOrThrow({
          where: { id: sellerId },
          include: sellerInclude,
        })
      : null;
    const workplaces = [...auth.sellerMemberships.map((membership) => membership.sellerId)];

    if (sellerId) {
      workplaces.push(sellerId);
    }

    const openWorkplaces = await this.prisma.seller.count({
      where: { id: { in: workplaces }, status: { in: [...portalStatuses] } },
    });

    return {
      account: {
        email: user.email,
        phone: user.phone,
        phoneVerified: user.phoneVerifiedAt !== null,
        hasPassword: user.passwordHash !== null,
      },
      seller: seller ? await this.toRegistrationSeller(seller) : null,
      portalOpen: openWorkplaces > 0,
      countries: sellerCountries,
    };
  }

  private async toRegistrationSeller(seller: SellerWithStore): Promise<RegistrationSeller> {
    const [store] = seller.stores;
    const { street, city, postalCode, countryCode } = seller.registeredAddress;

    return {
      id: seller.id,
      status: seller.status,
      reviewMessage: seller.reviewMessage,
      company: {
        countryCode: seller.countryCode,
        registrationNumber: seller.registrationNumber,
        legalName: seller.legalName,
        legalForm: seller.legalForm,
        vatNumber: seller.vatNumber,
        isVatPayer: seller.isVatPayer,
        address: { street, city, postalCode, countryCode },
        check: seller.companyCheck,
      },
      payoutAccount: await this.payouts.find(seller.id),
      store: store ? this.toRegistrationStore(store, seller.registeredAddressId) : null,
      documents: await this.documents.list(seller.id),
      requiredDocuments: requiredDocumentKinds(seller.countryCode),
    };
  }

  private toRegistrationStore(
    store: StoreOfSeller,
    registeredAddressId: string,
  ): RegistrationStore {
    const [smallestCopy] = store.logoImage?.copyWidths ?? [];
    const ownAddress =
      store.returnAddress && store.returnAddress.id !== registeredAddressId
        ? store.returnAddress
        : null;

    return {
      name: store.name,
      slug: store.slug,
      logo:
        store.logoImage && smallestCopy !== undefined
          ? {
              imageId: store.logoImage.id,
              url: this.storage.publicUrl(imageKey(store.logoImage.id, smallestCopy)),
            }
          : null,
      categoryIds: store.categories.map(({ categoryId }) => categoryId),
      returnAddress: ownAddress
        ? { street: ownAddress.street, city: ownAddress.city, postalCode: ownAddress.postalCode }
        : null,
    };
  }
}
