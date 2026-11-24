// mobilni-aplikace.md 2, NAB-035, Q-046, ADR-014
import type { PatientTagSource } from "@ansora/contracts"
import type { CardReading, TagReading } from "./nfc-reader"
import type { UploadStage } from "./upload-stage"

// NAB-141, NAB-162–165
export interface NfcReader {
	readsWithoutPrompt: boolean
	isSupported(): Promise<boolean>
	isEnabled(): Promise<boolean>
	openSettings(): Promise<void>
	readCard(instruction: string): Promise<CardReading>
	watchCard(): Promise<CardReading>
	readTag(instruction: string, content: PatientTagSource): Promise<TagReading>
	cancel(): Promise<void>
}

export type KeyDomain = "queue" | "viewing"

export interface KeyProtection {
	hardwareBacked: boolean
	secureElement: boolean
}

export interface EncryptedFile {
	path: string
	wrappedKey: string
}

export type SecureHardware = "secure_enclave" | "strongbox" | "keystore" | "unknown"

export type DevicePlatform = "ios" | "android"

export interface PublicKeyJwk {
	kty: "EC"
	crv: "P-256"
	x: string
	y: string
}

export interface DeviceKey {
	publicKeyJwk: PublicKeyJwk
	secureHardware: SecureHardware
}

export interface DeviceDescriptor {
	model: string
	osVersion: string
	platform: DevicePlatform
}

// CAP-021-R21
export interface ServerHpkeKey {
	serverKeyVersion: string
	publicKey: string
}

// CAP-009-R13
export interface SealedCopy {
	path: string
	enc: string
	suite: string
	serverKeyVersion: string
	// CAP-021-R21
	sha256: string
}

export interface PinAccount {
	displayName: string
}

export interface CurrentPinAccount {
	personalNumber: string
	displayName: string
	sessionEnd: string
}

export interface PinSetup {
	setupId: string
	pinProofSetup: string
}

export interface PinProofChallenge {
	challengeId: string
	value: string
	issuedAt: number
}

export interface CryptoAndKeys {
	deviceKey(): Promise<DeviceKey>
	signJws(headerJson: string, payloadJson: string): Promise<string>
	approvalFingerprint(): Promise<string>
	// RFC 9449, CAP-019-R29
	sha256Text(text: string): Promise<string>
	randomIdentifier(): Promise<string>
	deviceDescriptor(): Promise<DeviceDescriptor>
	ensureKeys(): Promise<KeyProtection>
	openViewing(): Promise<void>
	closeViewing(): Promise<void>
	storageDirectory(domain: KeyDomain): Promise<string>
	databaseKey(domain: KeyDomain): Promise<string>
	// CAP-009-S05, ADR-038, Q-076
	setStorageAside(domain: KeyDomain): Promise<void>
	encryptFile(sourcePath: string, domain: KeyDomain): Promise<EncryptedFile>
	encryptBytes(data: Uint8Array, domain: KeyDomain): Promise<EncryptedFile>
	decryptFile(path: string, wrappedKey: string, domain: KeyDomain): Promise<Uint8Array>
	removeFile(path: string): Promise<void>
	// CAP-009-R13, CAP-009-R05
	sealForServer(path: string, wrappedKey: string, domain: KeyDomain, serverKey: ServerHpkeKey): Promise<SealedCopy>
	preparePin(pin: string): Promise<PinSetup>
	commitPin(setupId: string, personalNumber: string, displayName: string): Promise<void>
	discardPin(setupId: string): Promise<void>
	pinProof(personalNumber: string, pin: string, challenge: PinProofChallenge): Promise<string>
	pinAccount(personalNumber: string): Promise<PinAccount | null>
	currentPinAccount(): Promise<CurrentPinAccount | null>
	setCurrentPinAccount(personalNumber: string, sessionEnd: string): Promise<void>
	renamePinAccount(personalNumber: string, displayName: string): Promise<void>
	// CAP-007-R04, CAP-009-R14
	eraseLocalData(): Promise<void>
	// CAP-025-R22
	forgetDeviceKey(): Promise<void>
}

export interface NetworkPinning {
	// NAB-143, CAP-010-R05, CAP-010-R06
	setPins(host: string, fingerprints: readonly string[]): Promise<void>
}

export interface OsIntegrity {
	// CAP-008-R01, CAP-008-R02, CAP-008-R10
	detect(): Promise<readonly string[]>
}

export interface IntegrityDetectedEvent {
	signals: readonly string[]
}

export type OsIntegrityEvents = {
	// CAP-008-R01, CAP-008-S02
	detected(detection: IntegrityDetectedEvent): void
}

export type ManagedConfigurationEvents = {
	// CAP-010-R07
	changed(): void
}

export interface ManagedConfiguration {
	// NAB-145, NAB-424
	read(): Promise<Readonly<Record<string, unknown>>>
}

export interface SecuredPhoto {
	image: EncryptedFile
	thumbnail: EncryptedFile
	width: number
	height: number
}

export interface PhotoCrop {
	x: number
	y: number
	width: number
	height: number
}

export type CameraEvents = {
	shutterKey(): void
}

export interface Camera {
	// TS-140, NAB-058, NAB-154, ADR-026, CAP-015-R14, CAP-015-R05, CAP-009-R09
	securePhoto(photo: Uint8Array): Promise<SecuredPhoto>
	// CAP-015-R34
	rotatePhoto(path: string, wrappedKey: string, quarterTurns: number): Promise<SecuredPhoto>
	cropPhoto(path: string, wrappedKey: string, crop: PhotoCrop): Promise<SecuredPhoto>
}

export interface PageCorner {
	x: number
	y: number
}

export interface PageCorners {
	topLeft: PageCorner
	topRight: PageCorner
	bottomRight: PageCorner
	bottomLeft: PageCorner
}

// CAP-018-R10, CAP-018-R11, ADR-026
export interface CroppedPage {
	page: EncryptedFile
	thumbnail: EncryptedFile
	// CAP-018-R10, CAP-018-S02
	corners: PageCorners | null
	width: number
	height: number
}

// CAP-018-R03, CAP-018-R08
export interface ScannedPage extends CroppedPage {
	original: EncryptedFile
}

export interface DocumentScanner {
	// NAB-191–195, Q-028, Q-050, CAP-018-R10, CAP-018-R11, CAP-015-R34
	recropPage(original: EncryptedFile, corners: PageCorners, quarterTurns: number): Promise<CroppedPage>
	// CAP-018-R03, CAP-018-R08
	scannedPage(id: string): Promise<ScannedPage>
}

export interface UploadField {
	name: string
	value: string
	contentType?: string
}

export interface UploadFile {
	name: string
	path: string
	filename: string
	contentType: string
}

// ADR-014, CAP-019-R32, CAP-002-R09
export interface UploadAnnouncement {
	url: string
	body: string
	headers: Readonly<Record<string, string>>
	verificationUrl: string
	verificationHeaders: Readonly<Record<string, string>>
}

export interface UploadRequest {
	// ADR-012
	id: string
	url: string
	headers: Readonly<Record<string, string>>
	fields: readonly UploadField[]
	files: readonly UploadFile[]
	announcement: UploadAnnouncement | null
	delayMs: number
}

// CAP-010-S06
export type UploadFailure = "certificate" | "network"

export interface UploadResult {
	id: string
	stage: UploadStage
	status: number | null
	body: string | null
	failure: UploadFailure | null
	code: number | null
}

export type BackgroundQueueEvents = {
	uploadFinished(result: UploadResult): void
	uploadFailed(result: UploadResult): void
}

export interface BackgroundQueue {
	// ADR-014
	readonly announcesFiles: boolean
	// NAB-205, NAB-412, CAP-010-R08
	upload(request: UploadRequest): Promise<void>
	// CAP-019-R32, CAP-025-R17
	grant(id: string, permission: string): Promise<void>
	pending(): Promise<readonly string[]>
	takeResults(): Promise<readonly UploadResult[]>
	// CAP-007-R04
	cancelAll(): Promise<void>
}

export type PermissionDecision = "granted" | "denied"

export interface CapturePermissions {
	camera: PermissionDecision
	nfc: PermissionDecision
}

export interface DevicePermissions {
	// NAB-058, NAB-141
	requestCapture(): Promise<CapturePermissions>
}

export * from "./background-queue"
export * from "./camera"
export * from "./crypto-and-keys"
export * from "./device-permissions"
export * from "./document-scanner"
export * from "./error-codes"
export * from "./hpke-envelope"
export * from "./managed-configuration"
export * from "./network-pinning"
export * from "./nfc-reader"
export * from "./os-integrity"
export * from "./upload-stage"
