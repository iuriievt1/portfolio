import type { LoginMethodOverrides } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"

@Injectable()
export class LoginMethodOverridesRepository {
	constructor(private readonly database: DatabaseService) {}

	async ofGroup(code: string | null): Promise<LoginMethodOverrides> {
		if (code === null) {
			return {}
		}
		const [row] = await this.database.sql<{ login_methods: LoginMethodOverrides }[]>`
			SELECT login_methods FROM device_group WHERE code = ${code}
		`
		return row?.login_methods ?? {}
	}
}
