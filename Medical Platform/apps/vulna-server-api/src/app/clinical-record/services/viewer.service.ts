import { Injectable } from "@nestjs/common"
import type { Viewer } from "../../acquisition/types/acquisition.types"
import type { CurrentSession } from "../../login/types/login.types"
import { ClinicalActorRepository } from "../repositories/clinical-actor.repository"

// CAP-003-R01, CAP-003-R07
@Injectable()
export class ViewerService {
	constructor(private readonly actors: ClinicalActorRepository) {}

	async viewerOf(current: CurrentSession): Promise<Viewer> {
		const actor = await this.actors.actorOf(current.session.userId)
		return { userId: current.session.userId, departmentId: actor?.department?.id }
	}
}
