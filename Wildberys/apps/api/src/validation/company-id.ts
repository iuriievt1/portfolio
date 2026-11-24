import { buildMessage, ValidateBy } from 'class-validator';

const weights = [8, 7, 6, 5, 4, 3, 2] as const;

/** A Czech company number (IČO): eight digits, the last one checks the seven before it. */
export function isCompanyId(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{8}$/.test(value)) {
    return false;
  }

  const digits = Array.from(value, Number);
  const sum = weights.reduce((total, weight, index) => total + weight * (digits[index] ?? 0), 0);

  return (11 - (sum % 11)) % 10 === digits[7];
}

/** Checks a field with `isCompanyId`. */
export function IsCompanyId(): PropertyDecorator {
  return ValidateBy({
    name: 'isCompanyId',
    validator: {
      validate: isCompanyId,
      defaultMessage: buildMessage(
        (eachPrefix) => `${eachPrefix}$property must be a Czech company number (IČO)`,
      ),
    },
  });
}
