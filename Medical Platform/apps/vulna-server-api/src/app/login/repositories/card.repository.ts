import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import type { CardBindingCodeRow, CardRow, NewCard, NewCardBindingCode, QrCodeRow } from "../types/login.types"
import type { IssuedQrCodeRow, NewQrCode, UserCardRow, UserQrCodeRow } from "../types/user-administration.types"

const CARD_COLUMNS = ["id", "user_id", "short_uid", "bound_at"] as const
const CODE_COLUMNS = ["code_hash", "user_id", "expires_at", "consumed_at"] as const
const BINDING_ORIGIN_DEVICE_WITH_CODE = "device_with_code"

@Injectable()
export class CardRepository {
	constructor(private readonly database: DatabaseService) {}

	async findValidCard(identifierHash: string): Promise<CardRow | undefined> {
		const [row] = await this.database.sql<CardRow[]>`
			SELECT ${this.database.sql(CARD_COLUMNS)} FROM card WHERE identifier_hash = ${identifierHash} AND revoked_at IS NULL
		`
		return row
	}

	async insertCard(sql: Executor, next: NewCard): Promise<CardRow> {
		const [row] = await sql<CardRow[]>`
			INSERT INTO card (id, user_id, identifier_hash, short_uid, binding_origin, bound_by_device_id, bound_at)
			VALUES (
				${randomUUID()}, ${next.userId}, ${next.identifierHash}, ${next.shortUid}, ${BINDING_ORIGIN_DEVICE_WITH_CODE},
				${next.boundByDeviceId}, ${next.boundAt}
			)
			RETURNING ${sql(CARD_COLUMNS)}
		`
		if (row === undefined) {
			throw new Error("inserting a card binding returned no row")
		}
		return row
	}

	async isRevokedIdentifier(identifierHash: string): Promise<boolean> {
		const rows = await this.database
			.sql`SELECT 1 FROM revoked_card_identifier WHERE identifier_hash = ${identifierHash}`
		return rows.length > 0
	}

	async findBindingCode(codeHash: string): Promise<CardBindingCodeRow | undefined> {
		const [row] = await this.database.sql<CardBindingCodeRow[]>`
			SELECT ${this.database.sql(CODE_COLUMNS)} FROM card_binding_code WHERE code_hash = ${codeHash}
		`
		return row
	}

	async consumeBindingCode(sql: Executor, codeHash: string, deviceId: string, now: Date): Promise<void> {
		await sql`
			UPDATE card_binding_code SET consumed_at = ${now}, consumed_by_device_id = ${deviceId}
			WHERE code_hash = ${codeHash} AND consumed_at IS NULL
		`
	}

	async supersedeBindingCodes(sql: Executor, userId: string, now: Date): Promise<void> {
		await sql`UPDATE card_binding_code SET consumed_at = ${now} WHERE user_id = ${userId} AND consumed_at IS NULL`
	}

	async insertBindingCode(sql: Executor, next: NewCardBindingCode): Promise<void> {
		await sql`
			INSERT INTO card_binding_code (code_hash, user_id, issued_by_user_id, issued_at, expires_at)
			VALUES (${next.codeHash}, ${next.userId}, ${next.issuedByUserId}, ${next.issuedAt}, ${next.expiresAt})
		`
	}

	async cardsOf(userId: string): Promise<UserCardRow[]> {
		return await this.database.sql<UserCardRow[]>`
			SELECT id, short_uid, bound_at, revoked_at FROM card WHERE user_id = ${userId} ORDER BY bound_at DESC, id DESC
		`
	}

	async ownerOfCard(sql: Executor, cardId: string): Promise<string | undefined> {
		const [row] = await sql<{ user_id: string }[]>`SELECT user_id FROM card WHERE id = ${cardId}`
		return row?.user_id
	}

	async revokeCard(sql: Executor, cardId: string, revokedByUserId: string, now: Date): Promise<boolean> {
		const rows = await sql`
			UPDATE card SET revoked_at = ${now}, revoked_by_user_id = ${revokedByUserId}
			WHERE id = ${cardId} AND revoked_at IS NULL
			RETURNING id
		`
		return rows.length > 0
	}

	async revokeCardsOf(sql: Executor, userId: string, revokedByUserId: string, now: Date): Promise<string[]> {
		const rows = await sql<{ id: string }[]>`
			UPDATE card SET revoked_at = ${now}, revoked_by_user_id = ${revokedByUserId}
			WHERE user_id = ${userId} AND revoked_at IS NULL
			RETURNING id
		`
		return rows.map((row) => row.id)
	}

	async qrCodesOf(userId: string): Promise<UserQrCodeRow[]> {
		return await this.database.sql<UserQrCodeRow[]>`
			SELECT id, issued_at, revoked_at FROM qr_code WHERE user_id = ${userId} ORDER BY issued_at DESC, id DESC
		`
	}

	async ownerOfQrCode(sql: Executor, qrCodeId: string): Promise<string | undefined> {
		const [row] = await sql<{ user_id: string }[]>`SELECT user_id FROM qr_code WHERE id = ${qrCodeId}`
		return row?.user_id
	}

	async revokeQrCode(sql: Executor, qrCodeId: string, revokedByUserId: string, now: Date): Promise<boolean> {
		const rows = await sql`
			UPDATE qr_code SET revoked_at = ${now}, revoked_by_user_id = ${revokedByUserId}
			WHERE id = ${qrCodeId} AND revoked_at IS NULL
			RETURNING id
		`
		return rows.length > 0
	}

	async findValidQrCode(identifier: string, keyVersion: number): Promise<QrCodeRow | undefined> {
		const [row] = await this.database.sql<QrCodeRow[]>`
			SELECT id, user_id FROM qr_code
			WHERE identifier = ${identifier} AND key_version = ${keyVersion} AND revoked_at IS NULL
		`
		return row
	}

	async revokeQrCodesOf(sql: Executor, userId: string, revokedByUserId: string, now: Date): Promise<string[]> {
		const rows = await sql<{ id: string }[]>`
			UPDATE qr_code SET revoked_at = ${now}, revoked_by_user_id = ${revokedByUserId}
			WHERE user_id = ${userId} AND revoked_at IS NULL
			RETURNING id
		`
		return rows.map((row) => row.id)
	}

	async insertQrCode(sql: Executor, next: NewQrCode): Promise<IssuedQrCodeRow> {
		const [row] = await sql<IssuedQrCodeRow[]>`
			INSERT INTO qr_code (id, user_id, identifier, key_version, issued_at, issued_by_user_id)
			VALUES (${randomUUID()}, ${next.userId}, ${next.identifier}, ${next.keyVersion}, ${next.issuedAt}, ${next.issuedByUserId})
			RETURNING id, issued_at
		`
		if (row === undefined) {
			throw new Error(`inserting a QR code of user ${next.userId} returned no row`)
		}
		return row
	}
}
