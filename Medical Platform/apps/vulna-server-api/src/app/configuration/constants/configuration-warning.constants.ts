import type { ConfigurationWarningCode } from "@ansora/core-server"

export const CONFIGURATION_WARNING_MESSAGE: Record<ConfigurationWarningCode, string> = {
	all_quick_login_methods_disabled:
		"Všechny tři rychlé metody přihlášení jsou vypnuté. Uživatelům zbývá jen plné přihlášení údaji Active Directory.",
	outbound_allowlist_update_required:
		"Změnila se adresa cílového systému. Pravidla odchozího allowlistu upraví dodavatel vzdáleným přístupem na vaše oznámení; do úpravy se spojení k novému cíli nenaváže.",
}
