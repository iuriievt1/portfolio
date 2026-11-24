import { z } from "zod"
import { TARGET_CODE_MAX_LENGTH } from "../constants/delivery-monitoring.constants"

// administration.yaml resumeDeliveryTarget targetCode
export const targetCodeSchema = z.string().trim().min(1).max(TARGET_CODE_MAX_LENGTH)
