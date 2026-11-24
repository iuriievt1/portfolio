import { Injectable } from '@nestjs/common';

import { AuditLogService } from '../audit/audit-log.service.js';
import { coversRetail } from '../company-registry/ares-trades.js';
import { auditActions } from '../audit/audit-events.js';
import {
  CompanyRegistry,
  type RegistryCompany,
  type RegistryTrade,
} from '../company-registry/company-registry.js';
import { PrismaService } from '../database/prisma.service.js';
import { AppException } from '../errors/app.exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  Locale,
  SellerDocumentKind,
  SellerMessageKind,
  SellerMessageSide,
  SellerStatus,
  StoreStatus,
} from '../generated/prisma/enums.js';
import { imageKey } from '../images/images.service.js';
import { LiveEvents } from '../live-events/live-events.js';
import { toPage } from '../pagination/page.js';
import { PayoutAccountsService } from '../payouts/payout-accounts.service.js';
import {
  SellerDocumentsService,
  type OpenedDocument,
} from '../seller-documents/seller-documents.service.js';
import { SellerMessagesService } from '../seller-messages/seller-messages.service.js';
import { SellerNotifier } from '../seller-messages/seller-notifier.js';
import { requiredDocumentKinds } from '../seller-registration/required-documents.js';
import { homeCountry } from '../seller-registration/seller-countries.js';
import { moveSeller } from '../sellers/seller-status.js';
import { RegisterCheckMemory } from './register-check-memory.js';
import { FileStorage } from '../storage/file-storage.js';
import { euCountries, vatLetters, type EuCountry } from '../vat-registry/eu-countries.js';
import { VatRegistry } from '../vat-registry/vat-registry.js';
import {
  sellerNotDraft,
  sellerNotFound,
  sellerStatusConflict,
} from './seller-moderation-errors.js';
import type {
  ModeratedSeller,
  ModeratedSellerRow,
  ModeratedSellersPage,
  RegisterDifference,
  SellerCounts,
  SellerHistoryEntry,
  SellerRegisterCheck,
  SellersQuery,
  SoldSection,
} from './seller-moderation.dto.js';

/** The names of categories are shown to the team in Czech, the first language of the catalog. */
const categoryNames = { where: { locale: Locale.cs } };

const storeInclude = {
  logoImage: true,
  returnAddress: true,
  categories: {
    orderBy: { category: { slug: 'asc' } },
    include: {
      category: {
        include: {
          translations: categoryNames,
          parent: { include: { translations: categoryNames } },
        },
      },
    },
  },
} satisfies Prisma.StoreInclude;

const rowInclude = {
  // The store of a seller in the check is the one made in the registration.
  stores: { orderBy: { createdAt: 'asc' }, take: 1, include: storeInclude },
  payoutAccount: { select: { status: true } },
  _count: {
    select: {
      documents: true,
      // The conversations where the seller wrote something nobody of the team has opened yet.
      conversations: {
        where: { messages: { some: { side: SellerMessageSide.SELLER, readAt: null } } },
      },
    },
  },
} satisfies Prisma.SellerInclude;

const cardInclude = {
  registeredAddress: true,
  reviewedBy: { select: { email: true } },
  stores: { orderBy: { createdAt: 'asc' }, take: 1, include: storeInclude },
} satisfies Prisma.SellerInclude;

type StoreOfSeller = Prisma.StoreGetPayload<{ include: typeof storeInclude }>;

/** How many entries of the history a card shows. A check of one seller makes far fewer. */
const historyLength = 50;

/** The sellers who wait come oldest first, so nobody waits behind a newer one. The others come newest first. */
const waiting: readonly SellerStatus[] = [
  SellerStatus.PENDING_REVIEW,
  SellerStatus.DOCUMENTS_REQUESTED,
];

/**
 * What a store sells, section by section. A store keeps either a whole section or some
 * of its subcategories, never both, so a section without subcategories here is sold whole.
 */
function categoriesOf(store: StoreOfSeller): SoldSection[] {
  const sections = new Map<string, string[]>();

  for (const { category } of store.categories) {
    const name = category.translations[0]?.name ?? category.slug;
    const section = category.parent?.translations[0]?.name ?? category.parent?.slug;
    const subcategories = sections.get(section ?? name) ?? [];

    sections.set(section ?? name, section ? [...subcategories, name] : subcategories);
  }

  return Array.from(sections, ([section, subcategories]) => ({ section, subcategories }));
}

function isEuCountry(countryCode: string): countryCode is EuCountry {
  return euCountries.some((country) => country === countryCode);
}

/** Two names are the same when they differ only in capital letters and spaces: registers write in capitals. */
function sameText(first: string, second: string): boolean {
  const tidy = (text: string): string => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

  return tidy(first) === tidy(second);
}

function isUnavailable(error: unknown): boolean {
  return (
    error instanceof AppException &&
    (error.code === 'COMPANY_REGISTRY_UNAVAILABLE' || error.code === 'VAT_REGISTRY_UNAVAILABLE')
  );
}

/** A check that has nothing of a register to show: none was asked, none answered, or it has no such record. */
function checkWithoutRecord(
  result: 'NOT_CHECKED' | 'UNAVAILABLE' | 'NOT_FOUND',
): SellerRegisterCheck {
  return {
    result,
    differences: [],
    registerName: null,
    registerAddress: null,
    trades: null,
    retailTrade: null,
  };
}

/**
 * The check of sellers by the Bluberi team: the queue of registrations, the card of one seller
 * with everything the team decides by, and the decisions themselves.
 */
@Injectable()
export class SellerModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly payouts: PayoutAccountsService,
    private readonly documents: SellerDocumentsService,
    private readonly storage: FileStorage,
    private readonly companies: CompanyRegistry,
    private readonly vatNumbers: VatRegistry,
    private readonly messages: SellerMessagesService,
    private readonly notifier: SellerNotifier,
    private readonly live: LiveEvents,
  ) {}

  private readonly registerChecks = new RegisterCheckMemory();

  /** How many sellers are in each status, for the tabs of the list. */
  async counts(): Promise<SellerCounts> {
    const groups = await this.prisma.seller.groupBy({ by: ['status'], _count: true });
    const counts: Record<SellerStatus, number> = {
      DRAFT: 0,
      PENDING_REVIEW: 0,
      DOCUMENTS_REQUESTED: 0,
      APPROVED: 0,
      REJECTED: 0,
      SUSPENDED: 0,
    };

    for (const { status, _count } of groups) {
      counts[status] = _count;
    }

    return counts;
  }

  /** One page of the sellers in a status. */
  async list({ status, limit, cursor }: SellersQuery): Promise<ModeratedSellersPage> {
    const rows = await this.prisma.seller.findMany({
      where: { status },
      orderBy: waiting.includes(status)
        ? [{ submittedAt: 'asc' }, { id: 'asc' }]
        : [{ id: 'desc' }],
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take: limit + 1,
      include: rowInclude,
    });
    const { items, nextCursor } = toPage(rows, limit);

    return {
      items: items.map((seller): ModeratedSellerRow => {
        const [store] = seller.stores;

        return {
          id: seller.id,
          legalName: seller.legalName,
          countryCode: seller.countryCode,
          registrationNumber: seller.registrationNumber,
          status: seller.status,
          companyCheck: seller.companyCheck,
          createdAt: seller.createdAt,
          submittedAt: seller.submittedAt,
          storeName: store?.name ?? null,
          logoUrl: store ? this.logoUrl(store) : null,
          categories: store ? categoriesOf(store) : [],
          documentsCount: seller._count.documents,
          unreadConversations: seller._count.conversations,
          payoutStatus: seller.payoutAccount?.status ?? null,
        };
      }),
      nextCursor,
    };
  }

  /** The card of one seller. */
  async find(sellerId: string): Promise<ModeratedSeller> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      include: cardInclude,
    });

    if (!seller) {
      throw sellerNotFound();
    }

    const [store] = seller.stores;
    const { street, city, postalCode, countryCode } = seller.registeredAddress;
    const registeredAddress = { street, city, postalCode, countryCode };
    const [payoutAccount, documents, history] = await Promise.all([
      this.payouts.find(seller.id),
      this.documents.list(seller.id),
      this.history(seller.id),
    ]);
    const returnAddress = store?.returnAddress;

    return {
      id: seller.id,
      status: seller.status,
      reviewMessage: seller.reviewMessage,
      createdAt: seller.createdAt,
      submittedAt: seller.submittedAt,
      reviewedAt: seller.reviewedAt,
      reviewedByEmail: seller.reviewedBy?.email ?? null,
      company: {
        countryCode: seller.countryCode,
        registrationNumber: seller.registrationNumber,
        legalName: seller.legalName,
        legalForm: seller.legalForm,
        vatNumber: seller.vatNumber,
        isVatPayer: seller.isVatPayer,
        check: seller.companyCheck,
        address: registeredAddress,
      },
      contactEmail: seller.contactEmail,
      contactPhone: seller.contactPhone,
      termsAcceptedAt: seller.termsAcceptedAt,
      selfCertifiedAt: seller.selfCertifiedAt,
      payoutAccount,
      store: store
        ? {
            name: store.name,
            slug: store.slug,
            logoUrl: this.logoUrl(store),
            categories: categoriesOf(store),
            returnAddress: returnAddress
              ? {
                  street: returnAddress.street,
                  city: returnAddress.city,
                  postalCode: returnAddress.postalCode,
                  countryCode: returnAddress.countryCode,
                }
              : registeredAddress,
          }
        : null,
      documents,
      requiredDocuments: requiredDocumentKinds(seller.countryCode),
      traceability: {
        contacts: seller.contactEmail.length > 0 && seller.contactPhone.length > 0,
        address: true,
        identityDocument: documents.some(
          ({ kind }) => kind === SellerDocumentKind.IDENTITY_DOCUMENT,
        ),
        paymentAccount: payoutAccount !== null && payoutAccount.status !== 'INCOMPLETE',
        registrationNumber: seller.registrationNumber.length > 0,
        selfCertification: seller.selfCertifiedAt !== null,
      },
      history,
    };
  }

  /**
   * What the public registers say about the company: the company register for a Czech company,
   * the register of VAT numbers for a company from another EU country that has a VAT number.
   * They are asked when the card is opened. The answer is kept for a few minutes, because an open
   * card reads itself again with every change in the admin. A seller that changed is asked about anew.
   */
  async registerCheck(sellerId: string): Promise<SellerRegisterCheck> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      include: { registeredAddress: true },
    });

    if (!seller) {
      throw sellerNotFound();
    }

    const sellerVersion = seller.updatedAt.getTime();
    const known = this.registerChecks.find(sellerId, sellerVersion);

    if (known) {
      return known;
    }

    const check = await this.askRegisters(seller);

    // An answer that did not come is not kept: the next reading of the card asks again.
    if (check.result !== 'UNAVAILABLE') {
      this.registerChecks.keep(sellerId, sellerVersion, check);
    }

    return check;
  }

  private async askRegisters(
    seller: Prisma.SellerGetPayload<{ include: { registeredAddress: true } }>,
  ): Promise<SellerRegisterCheck> {
    try {
      if (seller.countryCode === homeCountry) {
        const [company, trades] = await Promise.all([
          this.companies.find(seller.registrationNumber),
          this.companies.trades(seller.registrationNumber),
        ]);

        return company
          ? this.compareWithRegister(seller, company, trades)
          : checkWithoutRecord('NOT_FOUND');
      }

      if (seller.vatNumber === null || !isEuCountry(seller.countryCode)) {
        return checkWithoutRecord('NOT_CHECKED');
      }

      const letters = vatLetters(seller.countryCode);
      const record = await this.vatNumbers.find(
        seller.countryCode,
        seller.vatNumber.slice(letters.length),
      );

      if (!record) {
        return checkWithoutRecord('NOT_FOUND');
      }

      // The register of VAT numbers shares the name for most countries and nothing else that can be compared.
      const differs = record.name !== null && !sameText(record.name, seller.legalName);

      return {
        result: differs ? 'DIFFERS' : 'MATCHES',
        differences: differs ? ['legalName'] : [],
        registerName: record.name,
        registerAddress: record.address,
        trades: null,
        retailTrade: null,
      };
    } catch (error) {
      if (isUnavailable(error)) {
        return checkWithoutRecord('UNAVAILABLE');
      }

      throw error;
    }
  }

  /** The file of a document, for a member of the team. */
  async openDocument(
    sellerId: string,
    documentId: string,
    actorId: string,
  ): Promise<OpenedDocument> {
    return this.documents.open(sellerId, documentId, actorId);
  }

  /** Lets the seller sell. Its store opens with it. */
  async approve(actorId: string, sellerId: string): Promise<ModeratedSeller> {
    await this.mustExist(sellerId);

    const conversationId = await this.prisma.$transaction(async (transaction) => {
      const moved = await moveSeller(transaction, sellerId, 'approve', {
        reviewedAt: new Date(),
        reviewedById: actorId,
        reviewMessage: null,
      });

      if (!moved) {
        throw sellerStatusConflict();
      }

      await transaction.store.updateMany({
        where: { sellerId, status: StoreStatus.DRAFT },
        data: { status: StoreStatus.ACTIVE },
      });
      await this.audit.record(
        { action: 'seller.approved', actorId, target: { type: 'seller', id: sellerId } },
        transaction,
      );

      return this.messages.postDecision(
        { sellerId, authorId: actorId, kind: SellerMessageKind.APPROVED, body: '' },
        transaction,
      );
    });

    await this.messages.changed(sellerId, conversationId);
    await this.sellerChanged(sellerId);
    await this.notifier.approved(sellerId);

    return this.find(sellerId);
  }

  /** Asks the seller for documents. The seller adds them in the portal and sends the registration again. */
  async requestDocuments(
    actorId: string,
    sellerId: string,
    message: string,
  ): Promise<ModeratedSeller> {
    await this.decideWithMessage(actorId, sellerId, 'requestDocuments', message);
    await this.notifier.documentsRequested(sellerId, message);

    return this.find(sellerId);
  }

  /** Refuses the seller and says why. */
  async reject(actorId: string, sellerId: string, message: string): Promise<ModeratedSeller> {
    await this.decideWithMessage(actorId, sellerId, 'reject', message);
    await this.notifier.rejected(sellerId, message);

    return this.find(sellerId);
  }

  /** Takes a refused seller back into the check, for example after the seller objected. */
  async reopen(actorId: string, sellerId: string): Promise<ModeratedSeller> {
    await this.mustExist(sellerId);
    await this.prisma.$transaction(async (transaction) => {
      const moved = await moveSeller(transaction, sellerId, 'reopen', {
        reviewedAt: new Date(),
        reviewedById: actorId,
      });

      if (!moved) {
        throw sellerStatusConflict();
      }

      await this.audit.record(
        { action: 'seller.review_reopened', actorId, target: { type: 'seller', id: sellerId } },
        transaction,
      );
    });
    await this.sellerChanged(sellerId);

    return this.find(sellerId);
  }

  /**
   * Deletes a registration nobody sent, with its store, its documents and its payout account.
   * The company number becomes free for the company it belongs to.
   */
  async removeDraft(actorId: string, sellerId: string): Promise<void> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      include: { stores: { select: { returnAddressId: true } } },
    });

    if (!seller) {
      throw sellerNotFound();
    }

    const addressIds = [
      seller.registeredAddressId,
      ...seller.stores.flatMap(({ returnAddressId }) => (returnAddressId ? [returnAddressId] : [])),
    ];
    const cleanUps = await this.prisma.$transaction(async (transaction) => {
      const removeFiles = await this.documents.removeAllWithin(sellerId, transaction);
      const closeAccount = await this.payouts.removeWithin(sellerId, transaction);

      await transaction.store.deleteMany({ where: { sellerId } });

      // A registration sent in the meantime is not a draft any more and stays.
      const { count } = await transaction.seller.deleteMany({
        where: { id: sellerId, status: SellerStatus.DRAFT },
      });

      if (count === 0) {
        throw sellerNotDraft();
      }

      await transaction.address.deleteMany({ where: { id: { in: addressIds } } });
      await this.audit.record(
        {
          action: 'seller.draft_removed',
          actorId,
          target: { type: 'seller', id: sellerId },
          details: {
            countryCode: seller.countryCode,
            registrationNumber: seller.registrationNumber,
            legalName: seller.legalName,
          },
        },
        transaction,
      );

      return [removeFiles, closeAccount];
    });

    await this.sellerChanged(sellerId);

    for (const cleanUp of cleanUps) {
      await cleanUp();
    }
  }

  private async decideWithMessage(
    actorId: string,
    sellerId: string,
    decision: 'requestDocuments' | 'reject',
    message: string,
  ): Promise<void> {
    const rejected = decision === 'reject';

    await this.mustExist(sellerId);

    const conversationId = await this.prisma.$transaction(async (transaction) => {
      const moved = await moveSeller(transaction, sellerId, decision, {
        reviewedAt: new Date(),
        reviewedById: actorId,
        reviewMessage: message,
      });

      if (!moved) {
        throw sellerStatusConflict();
      }

      await this.audit.record(
        {
          action: rejected ? 'seller.rejected' : 'seller.documents_requested',
          actorId,
          target: { type: 'seller', id: sellerId },
          details: { message },
        },
        transaction,
      );

      return this.messages.postDecision(
        {
          sellerId,
          authorId: actorId,
          kind: rejected ? SellerMessageKind.REJECTED : SellerMessageKind.DOCUMENTS_REQUESTED,
          body: message,
        },
        transaction,
      );
    });

    // The decision is saved: the open pages of the seller and of the team show it at once.
    await this.messages.changed(sellerId, conversationId);
    await this.sellerChanged(sellerId);
  }

  /** Tells open pages that the status of a seller changed, or that the seller is gone. For a change that is saved. */
  private sellerChanged(sellerId: string): Promise<void> {
    return this.live.report({ kind: 'seller-changed', sellerId });
  }

  /** A decision about a seller nobody has is answered with "not found", not with a status that does not fit. */
  private async mustExist(sellerId: string): Promise<void> {
    const found = await this.prisma.seller.count({ where: { id: sellerId } });

    if (found === 0) {
      throw sellerNotFound();
    }
  }

  private compareWithRegister(
    seller: Prisma.SellerGetPayload<{ include: { registeredAddress: true } }>,
    company: RegistryCompany,
    trades: RegistryTrade[] | null,
  ): SellerRegisterCheck {
    const { street, city, postalCode, countryCode } = seller.registeredAddress;
    const { address } = company;
    const differences: RegisterDifference[] = [];

    if (company.legalName !== seller.legalName) differences.push('legalName');
    if (company.legalForm !== seller.legalForm) differences.push('legalForm');
    if (company.vatNumber !== seller.vatNumber) differences.push('vatNumber');
    if (
      address.street !== street ||
      address.city !== city ||
      address.postalCode !== postalCode ||
      address.countryCode !== countryCode
    ) {
      differences.push('address');
    }
    if (!company.isActive) differences.push('closed');

    return {
      result: differences.length > 0 ? 'DIFFERS' : 'MATCHES',
      differences,
      registerName: company.legalName,
      registerAddress: `${address.street}, ${address.postalCode} ${address.city}`,
      trades,
      retailTrade: trades ? coversRetail(trades) : null,
    };
  }

  private async history(sellerId: string): Promise<SellerHistoryEntry[]> {
    const entries = await this.prisma.auditLogEntry.findMany({
      where: { targetType: 'seller', targetId: sellerId },
      orderBy: { id: 'desc' },
      take: historyLength,
      include: { actor: { select: { email: true } } },
    });

    return entries.flatMap(({ id, action, actor, createdAt, details }) => {
      const known = auditActions.find((candidate) => candidate === action);
      const message =
        typeof details === 'object' && details !== null && 'message' in details
          ? details.message
          : null;

      return known
        ? [
            {
              id,
              action: known,
              actorEmail: actor?.email ?? null,
              createdAt,
              message: typeof message === 'string' ? message : null,
            },
          ]
        : [];
    });
  }

  private logoUrl(store: StoreOfSeller): string | null {
    const [smallestCopy] = store.logoImage?.copyWidths ?? [];

    return store.logoImage && smallestCopy !== undefined
      ? this.storage.publicUrl(imageKey(store.logoImage.id, smallestCopy))
      : null;
  }
}
