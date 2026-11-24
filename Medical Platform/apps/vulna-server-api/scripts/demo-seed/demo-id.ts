import { nameBasedUuid } from "../../src/libs/common/utils/name-based-uuid"

const DEMO_NAMESPACE = "fd506b87-b2c3-4753-8c78-c038eeb4f4ce"
const UID_ROOT = "2.25"

// RFC 9562
export function demoId(name: string): string {
	return nameBasedUuid(DEMO_NAMESPACE, name)
}

// integrace-dicom.md 4, NAB-370
export function studyInstanceUidOf(id: string): string {
	return `${UID_ROOT}.${BigInt(`0x${id.replaceAll("-", "")}`).toString()}`
}
