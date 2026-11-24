import { SetMetadata } from "@nestjs/common"

export const OUTSIDE_MOBILE_CONTRACT = "outsideMobileContract"

export const OutsideMobileContract = () => SetMetadata(OUTSIDE_MOBILE_CONTRACT, true)
