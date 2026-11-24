import { Injectable } from '@nestjs/common';

import { AuditLogService } from '../audit/audit-log.service.js';
import type { DatabaseClient } from '../database/database-client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { SellerDocumentKind } from '../generated/prisma/enums.js';
import { PrivateFileStorage } from '../storage/private-file-storage.js';
import { documentContentType, maxDocumentsPerSeller, tidyFileName } from './document-file.js';
import {
  documentInvalid,
  documentNotFound,
  documentsLimitReached,
} from './seller-document-errors.js';
import type { SellerDocumentInfo } from './seller-documents.dto.js';

/** What of a document is shown. The file itself is read only when somebody opens it. */
const shown = {
  id: true,
  kind: true,
  fileName: true,
  contentType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

export interface DocumentToAdd {
  readonly sellerId: string;
  readonly uploadedById: string;
  readonly kind: SellerDocumentKind;
  readonly fileName: string;
  readonly file: Buffer;
}

export interface OpenedDocument {
  readonly fileName: string;
  readonly contentType: string;
  readonly body: Buffer;
}

function documentKey(sellerId: string, documentId: string): string {
  return `seller-documents/${sellerId}/${documentId}`;
}

/**
 * The documents sellers give to Bluberi: identity documents, extracts from registers and what the team asks for.
 * The files lie in the closed storage. Who may add, delete or open one is decided by the caller.
 */
@Injectable()
export class SellerDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PrivateFileStorage,
    private readonly audit: AuditLogService,
  ) {}

  /** The documents of a seller, oldest first. */
  list(sellerId: string): Promise<SellerDocumentInfo[]> {
    return this.prisma.sellerDocument.findMany({
      where: { sellerId },
      orderBy: { id: 'asc' },
      select: shown,
    });
  }

  /** Stores a document of a seller. The file has to be a PDF, a JPEG or a PNG. */
  async add({ sellerId, uploadedById, kind, fileName, file }: DocumentToAdd): Promise<void> {
    const contentType = documentContentType(file);

    if (!contentType) {
      throw documentInvalid();
    }

    if (
      (await this.prisma.sellerDocument.count({ where: { sellerId } })) >= maxDocumentsPerSeller
    ) {
      throw documentsLimitReached();
    }

    const document = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.sellerDocument.create({
        data: {
          sellerId,
          uploadedById,
          kind,
          fileName: tidyFileName(fileName) || kind.toLowerCase(),
          contentType,
          sizeBytes: file.length,
        },
      });

      await this.audit.record(
        {
          action: 'seller.document_added',
          actorId: uploadedById,
          target: { type: 'seller', id: sellerId },
          details: { documentId: created.id, kind },
        },
        transaction,
      );

      return created;
    });

    try {
      await this.storage.put({ key: documentKey(sellerId, document.id), body: file, contentType });
    } catch (error) {
      // Nobody has seen the document yet, so the row can go: the database never points to a missing file.
      await this.prisma.sellerDocument.delete({ where: { id: document.id } });

      throw error;
    }
  }

  /** Deletes a document of a seller, with its file. */
  async remove(sellerId: string, documentId: string, actorId: string): Promise<void> {
    const document = await this.prisma.sellerDocument.findFirst({
      where: { id: documentId, sellerId },
    });

    if (!document) {
      throw documentNotFound();
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.sellerDocument.delete({ where: { id: document.id } });
      await this.audit.record(
        {
          action: 'seller.document_removed',
          actorId,
          target: { type: 'seller', id: sellerId },
          details: { documentId: document.id, kind: document.kind },
        },
        transaction,
      );
    });
    await this.storage.remove(documentKey(sellerId, document.id));
  }

  /** The file of a document, for a member of the team who checks the seller. The opening is written down. */
  async open(sellerId: string, documentId: string, actorId: string): Promise<OpenedDocument> {
    const document = await this.prisma.sellerDocument.findFirst({
      where: { id: documentId, sellerId },
    });

    if (!document) {
      throw documentNotFound();
    }

    const body = await this.storage.get(documentKey(sellerId, document.id));

    await this.audit.record(
      {
        action: 'seller.document_opened',
        actorId,
        target: { type: 'seller', id: sellerId },
        details: { documentId: document.id, kind: document.kind },
      },
      this.prisma,
    );

    return { fileName: document.fileName, contentType: document.contentType, body };
  }

  /**
   * Deletes every document of a seller as a part of a larger change. The returned function deletes
   * the files: call it once the change is saved, so no file is lost for a change that failed.
   */
  async removeAllWithin(sellerId: string, database: DatabaseClient): Promise<() => Promise<void>> {
    const documents = await database.sellerDocument.findMany({
      where: { sellerId },
      select: { id: true },
    });

    await database.sellerDocument.deleteMany({ where: { sellerId } });

    return async () => {
      await Promise.all(documents.map(({ id }) => this.storage.remove(documentKey(sellerId, id))));
    };
  }
}
