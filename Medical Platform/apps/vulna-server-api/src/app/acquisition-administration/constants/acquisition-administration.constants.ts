import { ADMIN_API_BASE_PATH } from "@ansora/contracts"
import { ACQUISITION_ID_PARAMETER } from "../../acquisition/constants/acquisition.constants"

// administration.yaml searchAcquisitions, getAcquisitionForAdministration
export const ACQUISITIONS_PATH = `${ADMIN_API_BASE_PATH}/acquisitions`
export const ACQUISITION_SUBPATH = `:${ACQUISITION_ID_PARAMETER}`
