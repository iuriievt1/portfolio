import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import type { RoleRow } from "../types/user-administration.types"

@Injectable()
export class RoleRepository {
	constructor(private readonly database: DatabaseService) {}

	async list(): Promise<RoleRow[]> {
		return await this.database.sql<RoleRow[]>`SELECT code, name FROM role ORDER BY code`
	}
}
