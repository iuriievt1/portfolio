import type { RegistryTrade, TradeKind } from './company-registry.js';

/** How the trade register writes the kind of a licence: one letter. */
const kindsByLetter: Readonly<Record<string, TradeKind>> = {
  L: 'FREE',
  R: 'CRAFT',
  V: 'PROFESSIONAL',
  K: 'CONCESSION',
};

/** The word the trade register uses for retail, in the names of trades and of their fields. */
const retail = /maloobchod/i;

/**
 * Whether these licences let their holder sell goods to buyers. In Czech law that is one field
 * of the free trade, "Velkoobchod a maloobchod", whatever the goods are: clothes, cosmetics, electronics.
 */
export function coversRetail(trades: readonly RegistryTrade[]): boolean {
  return trades.some(
    ({ name, fields }) => retail.test(name) || fields.some((field) => retail.test(field)),
  );
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/** The fields of a free trade that still hold. */
function fieldsOf(trade: JsonObject): string[] {
  return objects(trade.oboryCinnosti)
    .filter((field) => field.platnostDo === undefined)
    .map((field) => text(field.oborNazev))
    .filter((name) => name !== undefined);
}

/**
 * Reads the answer of ARES about the trade licences of one company (GET /ekonomicke-subjekty-rzp/{ico}).
 * Only licences that hold now are taken, and nothing about the people the register lists with them.
 * Undefined when the answer is not in the shape the register uses.
 */
export function toRegistryTrades(answer: unknown): RegistryTrade[] | undefined {
  if (!isObject(answer) || !Array.isArray(answer.zaznamy)) {
    return undefined;
  }

  return objects(answer.zaznamy)
    .flatMap((record) => objects(record.zivnosti))
    .filter((trade) => trade.datumZaniku === undefined)
    .flatMap((trade) => {
      const name = text(trade.predmetPodnikani);
      const kind = kindsByLetter[text(trade.druhZivnosti) ?? ''];
      const since = text(trade.datumVzniku);

      return name && kind && since ? [{ name, kind, since, fields: fieldsOf(trade) }] : [];
    });
}
