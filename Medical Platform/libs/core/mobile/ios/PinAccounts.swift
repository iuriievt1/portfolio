import CryptoKit
import ExpoModulesCore
import Foundation

struct PinAccount: Record {
  @Field var displayName: String = ""
}

struct PinSetup: Record {
  @Field var setupId: String = ""
  @Field var pinProofSetup: String = ""
}

struct PinProofChallenge: Record {
  @Field var challengeId: String = ""
  @Field var value: String = ""
  @Field var issuedAt: Int = 0
}

struct CurrentPinAccount: Record {
  @Field var personalNumber: String = ""
  @Field var displayName: String = ""
  @Field var sessionEnd: String = ""
}

final class PinAccountMissingException: Exception, @unchecked Sendable {
  override var code: String { "pin-account-missing" }
  override var reason: String { "No local account with a PIN exists for this personal number" }
}

final class PinSetupMissingException: Exception, @unchecked Sendable {
  override var code: String { "pin-setup-missing" }
  override var reason: String { "No prepared PIN exists under this setup id" }
}

final class PinInvalidException: Exception, @unchecked Sendable {
  override var code: String { "pin-invalid" }
  override var reason: String { "The PIN is not 4 to 8 digits" }
}

final class PinAccounts {
  static let keyParameters = Argon2.Parameters(memoryKiB: 65_536, passes: 3, parallelism: 1, tagLength: 32)
  static let saltBytes = 16
  static let seedBytes = 32
  static let pinPattern = "^[0-9]{4,8}$"
  private static let bitsPerByte = 8

  private static let directoryName = "pin-accounts"
  private static let pendingDirectoryName = "pending"
  private static let currentFileName = "current"
  private static let proofHeader = ["alg": "EdDSA", "typ": "JWT"]
  private static let publicKeyType = "OKP"
  private static let publicKeyCurve = "Ed25519"

  private struct CurrentMarker: Codable {
    var personalNumber: String
    var sessionEnd: String
  }

  private struct StoredAccount: Codable {
    var personalNumber: String
    var displayName: String
    let salt: Data
    let sealedSeed: Data
    let createdAt: Date
  }

  private let vault: Vault
  private let keys: MasterKeys
  private let deviceKey: DeviceKey

  init(vault: Vault, keys: MasterKeys, deviceKey: DeviceKey) {
    self.vault = vault
    self.keys = keys
    self.deviceKey = deviceKey
  }

  func prepare(pin: String) throws -> PinSetup {
    try Self.checkPin(pin)
    var seed = Self.randomBytes(Self.seedBytes)
    defer { seed.zero() }
    let salt = Self.randomBytes(Self.saltBytes)
    var pinKey = try Self.pinKey(pin: pin, salt: salt)
    defer { pinKey.zero() }
    try removePending()
    let setupId = UUID().uuidString
    let account = StoredAccount(personalNumber: "", displayName: "", salt: salt, sealedSeed: Self.xor(seed, pinKey), createdAt: Date())
    try seal(account, to: try pendingDirectory().appendingPathComponent(setupId))
    let publicKey = try Curve25519.Signing.PrivateKey(rawRepresentation: seed).publicKey
    let setup = PinSetup()
    setup.setupId = setupId
    setup.pinProofSetup = try Self.json([
      "kty": Self.publicKeyType, "crv": Self.publicKeyCurve, "x": publicKey.rawRepresentation.base64UrlEncoded(),
    ])
    return setup
  }

  func commit(setupId: String, personalNumber: String, displayName: String) throws {
    let pendingUrl = try pendingDirectory().appendingPathComponent(setupId)
    guard var account = try read(pendingUrl) else {
      throw PinSetupMissingException()
    }
    account.personalNumber = personalNumber
    account.displayName = displayName
    try seal(account, to: try fileUrl(personalNumber: personalNumber))
    try vault.remove(pendingUrl.path)
  }

  func discard(setupId: String) throws {
    try vault.remove(try pendingDirectory().appendingPathComponent(setupId).path)
  }

  func proof(personalNumber: String, pin: String, challenge: PinProofChallenge) throws -> String {
    try Self.checkPin(pin)
    guard let account = try read(try fileUrl(personalNumber: personalNumber)) else {
      throw PinAccountMissingException()
    }
    var pinKey = try Self.pinKey(pin: pin, salt: account.salt)
    defer { pinKey.zero() }
    var seed = Self.xor(account.sealedSeed, pinKey)
    defer { seed.zero() }
    let signingKey = try Curve25519.Signing.PrivateKey(rawRepresentation: seed)
    let payload = try Self.json([
      "challenge_id": challenge.challengeId,
      "value": challenge.value,
      "personal_number": personalNumber,
      "jkt": try deviceKey.thumbprint(),
      "iat": challenge.issuedAt,
    ])
    let signingInput = "\(Data(try Self.json(Self.proofHeader).utf8).base64UrlEncoded()).\(Data(payload.utf8).base64UrlEncoded())"
    let signature = try signingKey.signature(for: Data(signingInput.utf8))
    return "\(signingInput).\(signature.base64UrlEncoded())"
  }

  func account(personalNumber: String) throws -> PinAccount? {
    guard let stored = try read(try fileUrl(personalNumber: personalNumber)) else {
      return nil
    }
    let account = PinAccount()
    account.displayName = stored.displayName
    return account
  }

  func rename(personalNumber: String, displayName: String) throws {
    let url = try fileUrl(personalNumber: personalNumber)
    guard var stored = try read(url) else {
      throw PinAccountMissingException()
    }
    stored.displayName = displayName
    try seal(stored, to: url)
  }

  func current() throws -> CurrentPinAccount? {
    guard let marker = try readMarker(), let stored = try read(try fileUrl(personalNumber: marker.personalNumber)) else {
      return nil
    }
    let account = CurrentPinAccount()
    account.personalNumber = stored.personalNumber
    account.displayName = stored.displayName
    account.sessionEnd = marker.sessionEnd
    return account
  }

  func setCurrent(personalNumber: String, sessionEnd: String) throws {
    guard try read(try fileUrl(personalNumber: personalNumber)) != nil else {
      throw PinAccountMissingException()
    }
    try seal(CurrentMarker(personalNumber: personalNumber, sessionEnd: sessionEnd), to: try currentUrl())
  }

  private func removePending() throws {
    let directory = try pendingDirectory()
    for name in try FileManager.default.contentsOfDirectory(atPath: directory.path) {
      try vault.remove(directory.appendingPathComponent(name).path)
    }
  }

  private func read(_ url: URL) throws -> StoredAccount? {
    try open(url, as: StoredAccount.self)
  }

  private func readMarker() throws -> CurrentMarker? {
    try open(try currentUrl(), as: CurrentMarker.self)
  }

  private func open<Value: Decodable>(_ url: URL, as type: Value.Type) throws -> Value? {
    guard let sealed = try vault.readIfPresent(url) else {
      return nil
    }
    return try JSONDecoder().decode(type, from: try FileCipher.unwrap(sealed, using: try keys.key(for: .queue)))
  }

  private func seal<Value: Encodable>(_ value: Value, to url: URL) throws {
    try vault.write(try FileCipher.wrap(try JSONEncoder().encode(value), using: try keys.key(for: .queue)), to: url, in: .queue)
  }

  private func currentUrl() throws -> URL {
    try directory().appendingPathComponent(Self.currentFileName)
  }

  private func fileUrl(personalNumber: String) throws -> URL {
    try directory().appendingPathComponent(Data(SHA256.hash(data: Data(personalNumber.utf8))).hexEncoded())
  }

  private func directory() throws -> URL {
    try ensured(try vault.directory(for: .queue).appendingPathComponent(Self.directoryName, isDirectory: true))
  }

  private func pendingDirectory() throws -> URL {
    try ensured(try directory().appendingPathComponent(Self.pendingDirectoryName, isDirectory: true))
  }

  private func ensured(_ directory: URL) throws -> URL {
    if !FileManager.default.fileExists(atPath: directory.path) {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }
    return directory
  }

  private static func pinKey(pin: String, salt: Data) throws -> Data {
    Data(try Argon2.hash(password: Array(pin.utf8), salt: Array(salt), parameters: keyParameters))
  }

  private static func checkPin(_ pin: String) throws {
    guard pin.range(of: pinPattern, options: .regularExpression) != nil else {
      throw PinInvalidException()
    }
  }

  private static func randomBytes(_ count: Int) -> Data {
    SymmetricKey(size: .init(bitCount: count * bitsPerByte)).withUnsafeBytes { Data($0) }
  }

  private static func xor(_ left: Data, _ right: Data) -> Data {
    Data(zip(left, right).map { $0 ^ $1 })
  }

  private static func json(_ object: [String: Any]) throws -> String {
    String(decoding: try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]), as: UTF8.self)
  }
}

private extension Data {
  mutating func zero() {
    resetBytes(in: startIndex ..< endIndex)
  }
}
