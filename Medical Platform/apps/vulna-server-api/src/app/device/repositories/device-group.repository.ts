import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"

@Injectable()
export class DeviceGroupRepository {
	constructor(private readonly database: DatabaseService) {}

	async exists(code: string): Promise<boolean> {
		const rows = await this.database.sql`SELECT code FROM device_group WHERE code = ${code}`
		return rows.length > 0
	}
}
