import { Module } from "@nestjs/common"
import { IdentityProviderModule } from "../../libs/identity-provider/identity-provider.module"
import { AuditModule } from "../audit/audit.module"
import { ClinicalRecordModule } from "../clinical-record/clinical-record.module"
import { ConfigurationModule } from "../configuration/configuration.module"
import { AppUserRepository } from "./repositories/app-user.repository"
import { DepartmentRepository } from "./repositories/department.repository"
import { LoginPolicyService } from "./services/login-policy.service"
import { UserDepartmentService } from "./services/user-department.service"
import { UserIdentityService } from "./services/user-identity.service"

@Module({
	imports: [AuditModule, ClinicalRecordModule, ConfigurationModule, IdentityProviderModule],
	providers: [AppUserRepository, DepartmentRepository, LoginPolicyService, UserDepartmentService, UserIdentityService],
	exports: [AppUserRepository, DepartmentRepository, LoginPolicyService, UserDepartmentService, UserIdentityService],
})
export class UserIdentityModule {}
