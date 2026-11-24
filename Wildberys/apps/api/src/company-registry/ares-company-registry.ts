import { Injectable } from '@nestjs/common';

import { AppConfig } from '../config/app-config.js';
import { getJson, type JsonAnswer } from '../http/get-json.js';
import { toRegistryCompany } from './ares-record.js';
import { toRegistryTrades } from './ares-trades.js';
import { companyRegistryUnavailable } from './company-registry-errors.js';
import { CompanyRegistry, type RegistryCompany, type RegistryTrade } from './company-registry.js';

/** A person waits for this answer in a form, so the register gets a few seconds and no more. */
const timeoutMilliseconds = 8000;

/** How the register says it has no company with the number. */
const notFoundStatus = 404;

/** Reads companies from ARES, the public register of the Czech Ministry of Finance. */
@Injectable()
export class AresCompanyRegistry extends CompanyRegistry {
  constructor(private readonly config: AppConfig) {
    super();
  }

  find(ico: string): Promise<RegistryCompany | null> {
    return this.read(`ekonomicke-subjekty/${ico}`, toRegistryCompany);
  }

  /** The trade licences are kept by the trade register, which ARES reads under an address of its own. */
  trades(ico: string): Promise<RegistryTrade[] | null> {
    return this.read(`ekonomicke-subjekty-rzp/${ico}`, toRegistryTrades);
  }

  /** Asks ARES for one record. Null when ARES has none under this address. */
  private async read<Record>(
    path: string,
    toRecord: (body: unknown) => Record | undefined,
  ): Promise<Record | null> {
    let answer: JsonAnswer;

    try {
      answer = await getJson(`${this.config.aresUrl}/${path}`, timeoutMilliseconds);
    } catch (error) {
      throw companyRegistryUnavailable(error);
    }

    if (answer.status === notFoundStatus) {
      return null;
    }

    const record = answer.ok ? toRecord(answer.body) : undefined;

    if (record === undefined) {
      throw companyRegistryUnavailable();
    }

    return record;
  }
}
