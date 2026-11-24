/**
 * Apple reports only an identifier such as `iPhone18,3`; the name a person knows the device by
 * has to be translated here. Android reports the marketing name itself, so it is not listed.
 */
const APPLE_MODELS: Record<string, string> = {
	"iPhone12,1": "iPhone 11",
	"iPhone12,3": "iPhone 11 Pro",
	"iPhone12,5": "iPhone 11 Pro Max",
	"iPhone12,8": "iPhone SE (2. generace)",
	"iPhone13,1": "iPhone 12 mini",
	"iPhone13,2": "iPhone 12",
	"iPhone13,3": "iPhone 12 Pro",
	"iPhone13,4": "iPhone 12 Pro Max",
	"iPhone14,2": "iPhone 13 Pro",
	"iPhone14,3": "iPhone 13 Pro Max",
	"iPhone14,4": "iPhone 13 mini",
	"iPhone14,5": "iPhone 13",
	"iPhone14,6": "iPhone SE (3. generace)",
	"iPhone14,7": "iPhone 14",
	"iPhone14,8": "iPhone 14 Plus",
	"iPhone15,2": "iPhone 14 Pro",
	"iPhone15,3": "iPhone 14 Pro Max",
	"iPhone15,4": "iPhone 15",
	"iPhone15,5": "iPhone 15 Plus",
	"iPhone16,1": "iPhone 15 Pro",
	"iPhone16,2": "iPhone 15 Pro Max",
	"iPhone17,1": "iPhone 16 Pro",
	"iPhone17,2": "iPhone 16 Pro Max",
	"iPhone17,3": "iPhone 16",
	"iPhone17,4": "iPhone 16 Plus",
	"iPhone17,5": "iPhone 16e",
	"iPhone18,1": "iPhone 17 Pro",
	"iPhone18,2": "iPhone 17 Pro Max",
	"iPhone18,3": "iPhone 17",
	"iPhone18,4": "iPhone Air",
	"iPad13,18": "iPad (10. generace)",
	"iPad14,1": "iPad mini (6. generace)",
	"iPad14,2": "iPad mini (6. generace)",
	"iPad14,3": "iPad Pro 11 (4. generace)",
	"iPad14,5": "iPad Pro 12,9 (6. generace)",
	"iPad14,8": "iPad Air 11 (M2)",
	"iPad14,10": "iPad Air 13 (M2)",
	"iPad16,1": "iPad mini (A17 Pro)",
	"iPad16,3": "iPad Pro 11 (M4)",
	"iPad16,5": "iPad Pro 13 (M4)",
}

/** An identifier the table does not know is shown as it is — a wrong name would mislead IT. */
export function deviceModelName(model: string): string {
	return APPLE_MODELS[model] ?? model
}
