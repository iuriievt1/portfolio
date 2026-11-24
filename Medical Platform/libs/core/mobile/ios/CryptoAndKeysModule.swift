import CryptoKit
import ExpoModulesCore
import os
import Security
import UIKit

private let keyService = "cz.veevoy.ansora.vulna.keys"
private let databaseKeyFileName = "database.key"
private let wrappingAlgorithm = SecKeyAlgorithm.eciesEncryptionCofactorVariableIVX963SHA256AESGCM
private let signingAlgorithm = SecKeyAlgorithm.ecdsaSignatureMessageX962SHA256
private let ellipticKeyBits = 256
private let ellipticCoordinateBytes = 32
private let aesKeySize = SymmetricKeySize.bits256
private let randomIdentifierBytes = 16
private let deviceKeyTag = Data("\(keyService).device".utf8)
private let simulatorModelKey = "SIMULATOR_MODEL_IDENTIFIER"
private let subjectPublicKeyInfoPrefix: [UInt8] = [
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
  0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
]
private let crockfordAlphabet = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
private let fingerprintBits = 50
private let fingerprintGroup = 5
private let bitsPerCharacter = 5

enum KeyDomain: String, Enumerable, CaseIterable {
  case queue
  case viewing

  var accessibility: CFString {
    switch self {
    case .queue:
      return kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    case .viewing:
      return kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    }
  }

  var fileProtection: Data.WritingOptions {
    switch self {
    case .queue:
      return .completeFileProtectionUntilFirstUserAuthentication
    case .viewing:
      return .completeFileProtection
    }
  }

  var wrappingKeyTag: Data {
    Data("\(keyService).\(rawValue).wrapping".utf8)
  }

  var masterKeyAccount: String {
    "\(rawValue).master"
  }
}

struct KeyProtection: Record {
  @Field var hardwareBacked: Bool = false
  @Field var secureElement: Bool = false
}

struct EncryptedFile: Record {
  @Field var path: String = ""
  @Field var wrappedKey: String = ""
}

struct DeviceKeyInfo: Record {
  @Field var publicKeyJwk: [String: String] = [:]
  @Field var secureHardware: String = ""
}

struct DeviceDescriptor: Record {
  @Field var model: String = ""
  @Field var osVersion: String = ""
  @Field var platform: String = "ios"
}

struct ServerHpkeKey: Record {
  @Field var serverKeyVersion: String = ""
  @Field var publicKey: String = ""
}

struct SealedCopy: Record {
  @Field var path: String = ""
  @Field var enc: String = ""
  @Field var suite: String = ""
  @Field var serverKeyVersion: String = ""
  @Field var sha256: String = ""
}

final class ViewingKeyLockedException: Exception, @unchecked Sendable {
  override var code: String { "viewing-key-locked" }
  override var reason: String { "The viewing key is closed until a user signs in" }
}

final class DeviceLockedException: Exception, @unchecked Sendable {
  override var code: String { "device-locked" }
  override var reason: String { "The key is not available while the device is locked" }
}

final class KeyStorageException: GenericException<OSStatus>, @unchecked Sendable {
  override var code: String { "key-storage-unavailable" }
  override var reason: String { "The platform key storage failed with status \(param)" }
}

final class StorageFullException: Exception, @unchecked Sendable {
  override var code: String { "storage-full" }
  override var reason: String { "The device has no space left for the encrypted file" }
}

final class FileKeyInvalidException: Exception, @unchecked Sendable {
  override var code: String { "file-key-invalid" }
  override var reason: String { "The wrapped file key does not open this file" }
}

final class FileUnavailableException: GenericException<String>, @unchecked Sendable {
  override var code: String { "file-unavailable" }
  override var reason: String { "The file is not readable at \(param)" }
}

final class KeyInvalidatedException: Exception, @unchecked Sendable {
  override var code: String { "key-invalidated" }
  override var reason: String { "The master key no longer opens the storage of this domain" }
}

final class SignatureInvalidException: Exception, @unchecked Sendable {
  override var code: String { "signature-invalid" }
  override var reason: String { "The device key produced a signature in an unexpected format" }
}

final class ServerKeyInvalidException: Exception, @unchecked Sendable {
  override var code: String { "server-key-invalid" }
  override var reason: String { "The server public key is not an uncompressed P-256 point in base64url" }
}

public final class CryptoAndKeysModule: Module {
  private let keys = MasterKeys.shared
  private let deviceKey = DeviceKey()
  private let vault = Vault()
  private lazy var files = EncryptedFiles(vault: vault, keys: keys)
  private lazy var pinAccounts = PinAccounts(vault: vault, keys: keys, deviceKey: deviceKey)
  private let queue = DispatchQueue(label: "cz.veevoy.ansora.core.mobile.keys")

  public func definition() -> ModuleDefinition {
    Name("CryptoAndKeys")

    OnCreate {
      self.queue.async { Installation.forgetPreviousKeys() }
    }

    AsyncFunction("ensureKeys") { () -> KeyProtection in
      try self.keys.ensure()
    }.runOnQueue(queue)

    AsyncFunction("openViewing") {
      try self.keys.openViewing()
    }.runOnQueue(queue)

    AsyncFunction("closeViewing") {
      self.keys.closeViewing()
    }.runOnQueue(queue)

    AsyncFunction("storageDirectory") { (domain: KeyDomain) -> String in
      try self.vault.directory(for: domain).path
    }.runOnQueue(queue)

    AsyncFunction("databaseKey") { (domain: KeyDomain) -> String in
      try self.databaseKey(for: domain)
    }.runOnQueue(queue)

    AsyncFunction("setStorageAside") { (domain: KeyDomain) in
      try self.setStorageAside(domain)
    }.runOnQueue(queue)

    AsyncFunction("encryptFile") { (sourcePath: String, domain: KeyDomain) -> EncryptedFile in
      let plaintext = try self.vault.read(sourcePath)
      let stored = try self.files.store(plaintext, in: domain)
      try self.vault.remove(sourcePath)
      return stored
    }.runOnQueue(queue)

    AsyncFunction("encryptBytes") { (data: Data, domain: KeyDomain) -> EncryptedFile in
      try self.files.store(data, in: domain)
    }.runOnQueue(queue)

    AsyncFunction("decryptFile") { (path: String, wrappedKey: String, domain: KeyDomain) -> Data in
      try self.files.open(path: path, wrappedKey: wrappedKey, in: domain)
    }.runOnQueue(queue)

    AsyncFunction("removeFile") { (path: String) in
      try self.vault.remove(path)
    }.runOnQueue(queue)

    AsyncFunction("sealForServer") { (path: String, wrappedKey: String, domain: KeyDomain, serverKey: ServerHpkeKey) -> SealedCopy in
      try self.sealForServer(path: path, wrappedKey: wrappedKey, domain: domain, serverKey: serverKey)
    }.runOnQueue(queue)

    AsyncFunction("deviceKey") { () -> DeviceKeyInfo in
      try self.deviceKey.info()
    }.runOnQueue(queue)

    AsyncFunction("signJws") { (headerJson: String, payloadJson: String) -> String in
      try self.deviceKey.signJws(header: headerJson, payload: payloadJson)
    }.runOnQueue(queue)

    AsyncFunction("approvalFingerprint") { () -> String in
      try self.deviceKey.approvalFingerprint()
    }.runOnQueue(queue)

    AsyncFunction("sha256Text") { (text: String) -> String in
      Data(SHA256.hash(data: Data(text.utf8))).base64UrlEncoded()
    }

    AsyncFunction("randomIdentifier") { () -> String in
      SymmetricKey(size: .init(bitCount: randomIdentifierBytes * 8)).withUnsafeBytes { Data($0) }.base64UrlEncoded()
    }

    AsyncFunction("deviceDescriptor") { () -> DeviceDescriptor in
      DeviceDescriptor.current()
    }

    AsyncFunction("preparePin") { (pin: String) -> PinSetup in
      try self.pinAccounts.prepare(pin: pin)
    }.runOnQueue(queue)

    AsyncFunction("commitPin") { (setupId: String, personalNumber: String, displayName: String) in
      try self.pinAccounts.commit(setupId: setupId, personalNumber: personalNumber, displayName: displayName)
    }.runOnQueue(queue)

    AsyncFunction("discardPin") { (setupId: String) in
      try self.pinAccounts.discard(setupId: setupId)
    }.runOnQueue(queue)

    AsyncFunction("pinProof") { (personalNumber: String, pin: String, challenge: PinProofChallenge) -> String in
      try self.pinAccounts.proof(personalNumber: personalNumber, pin: pin, challenge: challenge)
    }.runOnQueue(queue)

    AsyncFunction("pinAccount") { (personalNumber: String) -> PinAccount? in
      try self.pinAccounts.account(personalNumber: personalNumber)
    }.runOnQueue(queue)

    AsyncFunction("renamePinAccount") { (personalNumber: String, displayName: String) in
      try self.pinAccounts.rename(personalNumber: personalNumber, displayName: displayName)
    }.runOnQueue(queue)

    AsyncFunction("currentPinAccount") { () -> CurrentPinAccount? in
      try self.pinAccounts.current()
    }.runOnQueue(queue)

    AsyncFunction("setCurrentPinAccount") { (personalNumber: String, sessionEnd: String) in
      try self.pinAccounts.setCurrent(personalNumber: personalNumber, sessionEnd: sessionEnd)
    }.runOnQueue(queue)

    // CAP-007-R04, CAP-009-R14
    AsyncFunction("eraseLocalData") {
      try self.keys.forgetAll()
      try VaultLayout.eraseAll(keeping: [pinsFileName])
    }.runOnQueue(queue)

    // CAP-025-R22
    AsyncFunction("forgetDeviceKey") {
      try self.deviceKey.forget()
    }.runOnQueue(queue)
  }

  // CAP-009-R13, CAP-009-R05
  private func sealForServer(path: String, wrappedKey: String, domain: KeyDomain, serverKey: ServerHpkeKey) throws -> SealedCopy {
    guard let recipient = Base64Url.decode(serverKey.publicKey) else {
      throw ServerKeyInvalidException()
    }
    let plaintext = try files.open(path: path, wrappedKey: wrappedKey, in: domain)
    let sealed: Hpke.Sealed
    do {
      sealed = try Hpke.seal(plaintext, recipientPublicKey: recipient)
    } catch Hpke.Failure.invalidRecipientKey {
      throw ServerKeyInvalidException()
    }
    let url = try vault.write(sealed.ciphertext, in: domain)
    let copy = SealedCopy()
    copy.path = url.path
    copy.enc = sealed.enc.base64UrlEncoded()
    copy.suite = Hpke.suite
    copy.serverKeyVersion = serverKey.serverKeyVersion
    copy.sha256 = SHA256.hash(data: plaintext).map { String(format: "%02x", $0) }.joined()
    return copy
  }

  // CAP-009-S05, Q-076
  private func databaseKey(for domain: KeyDomain) throws -> String {
    let master = try keys.key(for: domain)
    let url = try vault.directory(for: domain).appendingPathComponent(databaseKeyFileName)
    if let wrapped = try vault.readIfPresent(url) {
      do {
        return try FileCipher.unwrap(wrapped, using: master).hexEncoded()
      } catch is FileKeyInvalidException {
        throw KeyInvalidatedException()
      }
    }
    let raw = SymmetricKey(size: aesKeySize).withUnsafeBytes { Data($0) }
    try vault.write(try FileCipher.wrap(raw, using: master), to: url, in: domain)
    return raw.hexEncoded()
  }

  // CAP-009-S05, ADR-038, Q-076
  private func setStorageAside(_ domain: KeyDomain) throws {
    try keys.forgetUnusable(domain)
    try vault.setAside(domain, at: Date())
  }
}

// CAP-006-S06
enum Installation {
  private static let markerName = "installation"
  private static let log = Logger(subsystem: "cz.veevoy.ansora.core.mobile", category: "crypto-and-keys")

  static func forgetPreviousKeys(fileManager: FileManager = .default) {
    do {
      let marker = try markerUrl(fileManager: fileManager)
      if fileManager.fileExists(atPath: marker.path) {
        return
      }
      let isFreshInstall = !VaultLayout.exists(fileManager: fileManager)
      if isFreshInstall {
        try removeKeys()
      }
      try writeMarker(marker)
    } catch {
      log.error("Previous keys could not be removed: \(error.localizedDescription, privacy: .public)")
    }
  }

  private static func removeKeys() throws {
    for tag in [deviceKeyTag] + KeyDomain.allCases.map(\.wrappingKeyTag) {
      try removeKeychainItems([kSecClass: kSecClassKey, kSecAttrApplicationTag: tag])
    }
    try removeKeychainItems([kSecClass: kSecClassGenericPassword, kSecAttrService: keyService])
  }

  private static func markerUrl(fileManager: FileManager) throws -> URL {
    try fileManager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent(markerName)
  }

  private static func writeMarker(_ url: URL) throws {
    try Data().write(to: url)
    var marker = url
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try marker.setResourceValues(values)
  }
}

extension DeviceDescriptor {
  static func current() -> DeviceDescriptor {
    let descriptor = DeviceDescriptor()
    descriptor.model = machineIdentifier()
    descriptor.osVersion = UIDevice.current.systemVersion
    return descriptor
  }

  private static func machineIdentifier() -> String {
    if let simulatorModel = ProcessInfo.processInfo.environment[simulatorModelKey] {
      return simulatorModel
    }
    var systemInfo = utsname()
    uname(&systemInfo)
    return withUnsafeBytes(of: &systemInfo.machine) { bytes in
      String(decoding: bytes.prefix { $0 != 0 }, as: UTF8.self)
    }
  }
}

extension Data {
  func base64UrlEncoded() -> String {
    base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }

  func hexEncoded() -> String {
    map { String(format: "%02x", $0) }.joined()
  }
}

enum EllipticKeys {
  static func find(tag: Data) throws -> SecKey? {
    let query: [CFString: Any] = [
      kSecClass: kSecClassKey,
      kSecAttrApplicationTag: tag,
      kSecAttrKeyType: kSecAttrKeyTypeECSECPrimeRandom,
      kSecReturnRef: true,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    if status == errSecItemNotFound {
      return nil
    }
    if status == errSecInteractionNotAllowed {
      throw DeviceLockedException()
    }
    guard status == errSecSuccess, let key = item else {
      throw KeyStorageException(status)
    }
    return (key as! SecKey)
  }

  static func findOrCreate(tag: Data, accessibility: CFString) throws -> SecKey {
    if let existing = try find(tag: tag) {
      return existing
    }
    return try create(tag: tag, accessibility: accessibility, inSecureEnclave: SecureEnclave.isAvailable)
  }

  static func isInSecureEnclave(_ key: SecKey) -> Bool {
    guard let attributes = SecKeyCopyAttributes(key) as? [CFString: Any] else {
      return false
    }
    return (attributes[kSecAttrTokenID] as? String) == (kSecAttrTokenIDSecureEnclave as String)
  }

  static func error(_ error: Unmanaged<CFError>?) -> Exception {
    guard let cfError = error?.takeRetainedValue() else {
      return KeyStorageException(errSecInternalError)
    }
    let status = OSStatus(CFErrorGetCode(cfError))
    return status == errSecInteractionNotAllowed ? DeviceLockedException() : KeyStorageException(status)
  }

  private static func create(tag: Data, accessibility: CFString, inSecureEnclave: Bool) throws -> SecKey {
    var error: Unmanaged<CFError>?
    var privateKeyAttributes: [CFString: Any] = [
      kSecAttrIsPermanent: true,
      kSecAttrApplicationTag: tag,
    ]
    var attributes: [CFString: Any] = [
      kSecAttrKeyType: kSecAttrKeyTypeECSECPrimeRandom,
      kSecAttrKeySizeInBits: ellipticKeyBits,
    ]
    if inSecureEnclave {
      guard let access = SecAccessControlCreateWithFlags(nil, accessibility, .privateKeyUsage, &error) else {
        throw self.error(error)
      }
      privateKeyAttributes[kSecAttrAccessControl] = access
      attributes[kSecAttrTokenID] = kSecAttrTokenIDSecureEnclave
    } else {
      privateKeyAttributes[kSecAttrAccessible] = accessibility
    }
    attributes[kSecPrivateKeyAttrs] = privateKeyAttributes
    guard let key = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
      throw self.error(error)
    }
    return key
  }
}

final class DeviceKey {
  private var privateKey: SecKey?

  func info() throws -> DeviceKeyInfo {
    let key = try key()
    let info = DeviceKeyInfo()
    info.publicKeyJwk = try jwk(of: key)
    info.secureHardware = EllipticKeys.isInSecureEnclave(key) ? "secure_enclave" : "unknown"
    return info
  }

  func signJws(header: String, payload: String) throws -> String {
    let signingInput = "\(Data(header.utf8).base64UrlEncoded()).\(Data(payload.utf8).base64UrlEncoded())"
    let signature = try sign(Data(signingInput.utf8))
    return "\(signingInput).\(signature.base64UrlEncoded())"
  }

  func thumbprint() throws -> String {
    let jwk = try jwk(of: try key())
    let canonical = "{\"crv\":\"\(jwk["crv"]!)\",\"kty\":\"\(jwk["kty"]!)\",\"x\":\"\(jwk["x"]!)\",\"y\":\"\(jwk["y"]!)\"}"
    return Data(SHA256.hash(data: Data(canonical.utf8))).base64UrlEncoded()
  }

  // CAP-025-R22
  func forget() throws {
    privateKey = nil
    try removeKeychainItems([kSecClass: kSecClassKey, kSecAttrApplicationTag: deviceKeyTag])
  }

  func approvalFingerprint() throws -> String {
    let digest = SHA256.hash(data: try subjectPublicKeyInfo())
    let characters = crockfordBase32(Data(digest), bits: fingerprintBits)
    let split = characters.index(characters.startIndex, offsetBy: fingerprintGroup)
    return "\(characters[..<split])-\(characters[split...])"
  }

  private func subjectPublicKeyInfo() throws -> Data {
    Data(subjectPublicKeyInfoPrefix) + (try publicKeyPoint())
  }

  private func publicKeyPoint() throws -> Data {
    guard let publicKey = SecKeyCopyPublicKey(try key()) else {
      throw KeyStorageException(errSecInvalidKeyRef)
    }
    var error: Unmanaged<CFError>?
    guard let point = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
      throw EllipticKeys.error(error)
    }
    guard point.count == 1 + 2 * ellipticCoordinateBytes else {
      throw KeyStorageException(errSecInvalidKeyRef)
    }
    return point
  }

  private func key() throws -> SecKey {
    if let privateKey {
      return privateKey
    }
    let key = try EllipticKeys.findOrCreate(tag: deviceKeyTag, accessibility: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly)
    privateKey = key
    return key
  }

  private func sign(_ data: Data) throws -> Data {
    var error: Unmanaged<CFError>?
    guard let der = SecKeyCreateSignature(try key(), signingAlgorithm, data as CFData, &error) as Data? else {
      throw EllipticKeys.error(error)
    }
    return try EcdsaSignature.raw(fromDer: der)
  }

  private func jwk(of key: SecKey) throws -> [String: String] {
    let point = try publicKeyPoint()
    let x = point.subdata(in: 1 ..< 1 + ellipticCoordinateBytes)
    let y = point.subdata(in: 1 + ellipticCoordinateBytes ..< point.count)
    return ["kty": "EC", "crv": "P-256", "x": x.base64UrlEncoded(), "y": y.base64UrlEncoded()]
  }
}

func crockfordBase32(_ digest: Data, bits: Int) -> String {
  var out = ""
  for bit in stride(from: 0, to: bits, by: bitsPerCharacter) {
    out.append(crockfordAlphabet[readBits(digest, offset: bit, count: bitsPerCharacter)])
  }
  return out
}

private func readBits(_ digest: Data, offset: Int, count: Int) -> Int {
  var value = 0
  for index in 0 ..< count {
    let bit = offset + index
    let byte = digest[digest.startIndex + (bit >> 3)]
    value = (value << 1) | Int((byte >> (7 - UInt8(bit & 7))) & 1)
  }
  return value
}

enum EcdsaSignature {
  private static let sequenceTag: UInt8 = 0x30
  private static let integerTag: UInt8 = 0x02

  static func raw(fromDer der: Data) throws -> Data {
    var reader = DerReader(der)
    guard try reader.readTag() == sequenceTag else {
      throw SignatureInvalidException()
    }
    _ = try reader.readLength()
    let r = try readInteger(&reader)
    let s = try readInteger(&reader)
    return r + s
  }

  private static func readInteger(_ reader: inout DerReader) throws -> Data {
    guard try reader.readTag() == integerTag else {
      throw SignatureInvalidException()
    }
    let value = try reader.readBytes(try reader.readLength())
    let significant = value.drop { $0 == 0 }
    guard significant.count <= ellipticCoordinateBytes else {
      throw SignatureInvalidException()
    }
    return Data(repeating: 0, count: ellipticCoordinateBytes - significant.count) + significant
  }
}

struct DerReader {
  private let bytes: Data
  private var offset: Int

  init(_ bytes: Data) {
    self.bytes = bytes
    offset = bytes.startIndex
  }

  mutating func readTag() throws -> UInt8 {
    try readByte()
  }

  mutating func readLength() throws -> Int {
    let first = try readByte()
    guard first & 0x80 != 0 else {
      return Int(first)
    }
    let lengthBytes = Int(first & 0x7f)
    guard lengthBytes > 0, lengthBytes <= 2 else {
      throw SignatureInvalidException()
    }
    var length = 0
    for _ in 0 ..< lengthBytes {
      length = length << 8 | Int(try readByte())
    }
    return length
  }

  mutating func readBytes(_ count: Int) throws -> Data {
    guard count >= 0, offset + count <= bytes.endIndex else {
      throw SignatureInvalidException()
    }
    let slice = bytes.subdata(in: offset ..< offset + count)
    offset += count
    return slice
  }

  private mutating func readByte() throws -> UInt8 {
    guard offset < bytes.endIndex else {
      throw SignatureInvalidException()
    }
    let byte = bytes[offset]
    offset += 1
    return byte
  }
}

enum FileCipher {
  struct Sealed {
    let ciphertext: Data
    let wrappedKey: Data
  }

  static func seal(_ plaintext: Data, using master: SymmetricKey) throws -> Sealed {
    let fileKey = SymmetricKey(size: aesKeySize)
    let ciphertext = try combined(AES.GCM.seal(plaintext, using: fileKey))
    let wrappedKey = try wrap(fileKey.withUnsafeBytes { Data($0) }, using: master)
    return Sealed(ciphertext: ciphertext, wrappedKey: wrappedKey)
  }

  static func open(_ ciphertext: Data, wrappedKey: Data, using master: SymmetricKey) throws -> Data {
    let fileKey = SymmetricKey(data: try unwrap(wrappedKey, using: master))
    do {
      return try AES.GCM.open(AES.GCM.SealedBox(combined: ciphertext), using: fileKey)
    } catch is CryptoKitError {
      throw FileKeyInvalidException()
    }
  }

  static func wrap(_ key: Data, using master: SymmetricKey) throws -> Data {
    try combined(AES.GCM.seal(key, using: master))
  }

  static func unwrap(_ wrapped: Data, using master: SymmetricKey) throws -> Data {
    do {
      return try AES.GCM.open(AES.GCM.SealedBox(combined: wrapped), using: master)
    } catch is CryptoKitError {
      throw FileKeyInvalidException()
    }
  }

  private static func combined(_ box: AES.GCM.SealedBox) throws -> Data {
    guard let combined = box.combined else {
      throw FileKeyInvalidException()
    }
    return combined
  }
}

struct EncryptedFiles {
  let vault: Vault
  let keys: MasterKeys

  func store(_ plaintext: Data, in domain: KeyDomain) throws -> EncryptedFile {
    let sealed = try FileCipher.seal(plaintext, using: try keys.key(for: domain))
    let url = try vault.write(sealed.ciphertext, in: domain)
    let stored = EncryptedFile()
    stored.path = url.path
    stored.wrappedKey = sealed.wrappedKey.base64EncodedString()
    return stored
  }

  func open(path: String, wrappedKey: String, in domain: KeyDomain) throws -> Data {
    guard let wrapped = Data(base64Encoded: wrappedKey) else {
      throw FileKeyInvalidException()
    }
    let master = try keys.key(for: domain)
    return try FileCipher.open(try vault.read(path), wrappedKey: wrapped, using: master)
  }
}

final class Vault {
  private let fileManager = FileManager.default

  func write(_ data: Data, in domain: KeyDomain) throws -> URL {
    let url = try directory(for: domain).appendingPathComponent(UUID().uuidString)
    try write(data, to: url, in: domain)
    return url
  }

  func write(_ data: Data, to url: URL, in domain: KeyDomain) throws {
    do {
      try data.write(to: url, options: [.atomic, domain.fileProtection])
    } catch let error as NSError where error.code == NSFileWriteOutOfSpaceError {
      throw StorageFullException()
    }
  }

  func read(_ path: String) throws -> Data {
    guard let data = fileManager.contents(atPath: path) else {
      throw FileUnavailableException(path)
    }
    return data
  }

  func readIfPresent(_ url: URL) throws -> Data? {
    guard fileManager.fileExists(atPath: url.path) else {
      return nil
    }
    return try read(url.path)
  }

  func remove(_ path: String) throws {
    guard fileManager.fileExists(atPath: path) else {
      return
    }
    try fileManager.removeItem(atPath: path)
  }

  func directory(for domain: KeyDomain) throws -> URL {
    let directory = try domainDirectory(domain)
    if !fileManager.fileExists(atPath: directory.path) {
      try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
    }
    return directory
  }

  // CAP-009-S05, ADR-038, Q-076
  func setAside(_ domain: KeyDomain, at date: Date) throws {
    try VaultLayout.setAside(try domainDirectory(domain), at: date, fileManager: fileManager)
  }

  private func domainDirectory(_ domain: KeyDomain) throws -> URL {
    try VaultLayout.root(fileManager: fileManager).appendingPathComponent(domain.rawValue, isDirectory: true)
  }
}

// CAP-007-R04, CAP-009-R14
final class MasterKeys {
  static let shared = MasterKeys()

  private let lock = NSLock()
  private var queueKey: SymmetricKey?
  private var viewingKey: SymmetricKey?

  private init() {}

  func ensure() throws -> KeyProtection {
    lock.lock()
    defer { lock.unlock() }
    for domain in KeyDomain.allCases {
      _ = try wrappedMasterKey(for: domain)
    }
    let inSecureEnclave = EllipticKeys.isInSecureEnclave(try existingWrappingKey(for: .queue))
    let protection = KeyProtection()
    protection.hardwareBacked = inSecureEnclave
    protection.secureElement = inSecureEnclave
    return protection
  }

  func openViewing() throws {
    lock.lock()
    defer { lock.unlock() }
    viewingKey = try unwrapMasterKey(for: .viewing)
  }

  func closeViewing() {
    lock.lock()
    defer { lock.unlock() }
    viewingKey = nil
  }

  func key(for domain: KeyDomain) throws -> SymmetricKey {
    lock.lock()
    defer { lock.unlock() }
    switch domain {
    case .queue:
      if let queueKey {
        return queueKey
      }
      let key = try unwrapMasterKey(for: .queue)
      queueKey = key
      return key
    case .viewing:
      guard let viewingKey else {
        throw ViewingKeyLockedException()
      }
      return viewingKey
    }
  }

  private func wrappedMasterKey(for domain: KeyDomain) throws -> Data {
    if let stored = try readKeychainData(account: domain.masterKeyAccount) {
      return stored
    }
    let wrappingKey = try wrappingKey(for: domain)
    guard let publicKey = SecKeyCopyPublicKey(wrappingKey) else {
      throw KeyStorageException(errSecInvalidKeyRef)
    }
    let master = SymmetricKey(size: aesKeySize).withUnsafeBytes { Data($0) }
    var error: Unmanaged<CFError>?
    guard let wrapped = SecKeyCreateEncryptedData(publicKey, wrappingAlgorithm, master as CFData, &error) as Data? else {
      throw EllipticKeys.error(error)
    }
    try writeKeychainData(wrapped, account: domain.masterKeyAccount, accessibility: domain.accessibility)
    return wrapped
  }

  private func unwrapMasterKey(for domain: KeyDomain) throws -> SymmetricKey {
    let wrapped = try wrappedMasterKey(for: domain)
    let wrappingKey = try existingWrappingKey(for: domain)
    var error: Unmanaged<CFError>?
    guard let raw = SecKeyCreateDecryptedData(wrappingKey, wrappingAlgorithm, wrapped as CFData, &error) as Data? else {
      throw EllipticKeys.error(error)
    }
    return SymmetricKey(data: raw)
  }

  // CAP-007-R04, CAP-009-R14
  func forgetAll() throws {
    lock.lock()
    defer { lock.unlock() }
    queueKey = nil
    viewingKey = nil
    for domain in KeyDomain.allCases {
      try removeKeychainData(account: domain.masterKeyAccount)
      try removeKeychainItems([kSecClass: kSecClassKey, kSecAttrApplicationTag: domain.wrappingKeyTag])
    }
  }

  // CAP-009-S05, Q-076
  func forgetUnusable(_ domain: KeyDomain) throws {
    lock.lock()
    defer { lock.unlock() }
    switch domain {
    case .queue:
      queueKey = nil
    case .viewing:
      viewingKey = nil
    }
    if try isWrappingKeyLost(for: domain) {
      try removeKeychainData(account: domain.masterKeyAccount)
    }
  }

  private func wrappingKey(for domain: KeyDomain) throws -> SecKey {
    try EllipticKeys.findOrCreate(tag: domain.wrappingKeyTag, accessibility: domain.accessibility)
  }

  // CAP-009-S05, Q-076
  private func existingWrappingKey(for domain: KeyDomain) throws -> SecKey {
    guard let key = try EllipticKeys.find(tag: domain.wrappingKeyTag) else {
      throw KeyInvalidatedException()
    }
    return key
  }

  private func isWrappingKeyLost(for domain: KeyDomain) throws -> Bool {
    guard try readKeychainData(account: domain.masterKeyAccount) != nil else {
      return false
    }
    return try EllipticKeys.find(tag: domain.wrappingKeyTag) == nil
  }

  private func readKeychainData(account: String) throws -> Data? {
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: keyService,
      kSecAttrAccount: account,
      kSecReturnData: true,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    if status == errSecItemNotFound {
      return nil
    }
    if status == errSecInteractionNotAllowed {
      throw DeviceLockedException()
    }
    guard status == errSecSuccess, let data = item as? Data else {
      throw KeyStorageException(status)
    }
    return data
  }

  private func writeKeychainData(_ data: Data, account: String, accessibility: CFString) throws {
    let attributes: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: keyService,
      kSecAttrAccount: account,
      kSecAttrAccessible: accessibility,
      kSecValueData: data,
    ]
    let status = SecItemAdd(attributes as CFDictionary, nil)
    guard status == errSecSuccess else {
      throw KeyStorageException(status)
    }
  }

  private func removeKeychainData(account: String) throws {
    try removeKeychainItems([kSecClass: kSecClassGenericPassword, kSecAttrService: keyService, kSecAttrAccount: account])
  }
}

private func removeKeychainItems(_ query: [CFString: Any]) throws {
  let status = SecItemDelete(query as CFDictionary)
  guard status == errSecSuccess || status == errSecItemNotFound else {
    throw KeyStorageException(status)
  }
}
