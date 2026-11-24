package cz.veevoy.ansora.core.mobile

import android.annotation.TargetApi
import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.Enumerable
import java.io.File
import java.io.IOException
import java.math.BigInteger
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.Signature
import java.security.UnrecoverableKeyException
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.util.UUID
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

private const val KEY_STORE = "AndroidKeyStore"
private const val KEY_ALIAS_PREFIX = "cz.veevoy.ansora.vulna.keys."
private const val DEVICE_KEY_ALIAS = KEY_ALIAS_PREFIX + "device"
private const val DATABASE_KEY_FILE_NAME = "database.key"
private const val AES_KEY_BITS = 256
private const val DATABASE_KEY_BYTES = AES_KEY_BITS / Byte.SIZE_BITS
private const val RANDOM_IDENTIFIER_BYTES = 16
private const val GCM_TRANSFORMATION = "AES/GCM/NoPadding"
private const val GCM_TAG_BITS = 128
private const val GCM_NONCE_BYTES = 12
private const val NO_SPACE_LEFT = "ENOSPC"
internal const val ELLIPTIC_CURVE = "secp256r1"
private const val ELLIPTIC_COORDINATE_BYTES = 32
private const val SIGNATURE_ALGORITHM = "SHA256withECDSA"
private const val BASE64_URL = Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING
private const val CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
private const val FINGERPRINT_BITS = 50
private const val FINGERPRINT_GROUP = 5
private const val BITS_PER_CHARACTER = 5

enum class KeyDomain(val value: String) : Enumerable {
  QUEUE("queue"),
  VIEWING("viewing");

  val alias: String
    get() = KEY_ALIAS_PREFIX + value + ".master"

  val requiresUnlockedDevice: Boolean
    get() = this == VIEWING
}

class KeyProtection : Record {
  @Field var hardwareBacked: Boolean = false
  @Field var secureElement: Boolean = false
}

class EncryptedFile : Record {
  @Field var path: String = ""
  @Field var wrappedKey: String = ""
}

class DeviceKeyInfo : Record {
  @Field var publicKeyJwk: Map<String, String> = emptyMap()
  @Field var secureHardware: String = ""
}

class DeviceDescriptor : Record {
  @Field var model: String = ""
  @Field var osVersion: String = ""
  @Field var platform: String = "android"
}

class ServerHpkeKey : Record {
  @Field var serverKeyVersion: String = ""
  @Field var publicKey: String = ""
}

class SealedCopy : Record {
  @Field var path: String = ""
  @Field var enc: String = ""
  @Field var suite: String = ""
  @Field var serverKeyVersion: String = ""
  @Field var sha256: String = ""
}

class ViewingKeyLockedException :
  CodedException("viewing-key-locked", "The viewing key is closed until a user signs in", null)

class StorageFullException :
  CodedException("storage-full", "The device has no space left for the encrypted file", null)

class FileKeyInvalidException :
  CodedException("file-key-invalid", "The wrapped file key does not open this file", null)

class FileUnavailableException(path: String) :
  CodedException("file-unavailable", "The file is not readable at $path", null)

class KeyInvalidatedException :
  CodedException("key-invalidated", "The master key no longer opens the storage of this domain", null)

class SignatureInvalidException :
  CodedException("signature-invalid", "The device key produced a signature in an unexpected format", null)

class ServerKeyInvalidException :
  CodedException("server-key-invalid", "The server public key is not an uncompressed P-256 point in base64url", null)

class CryptoAndKeysModule : Module() {
  private val keys = MasterKeys()
  private val deviceKey = DeviceKey()
  private val vault by lazy { Vault(appContext.reactContext ?: throw Exceptions.ReactContextLost()) }
  private val files by lazy { EncryptedFiles(vault, keys) }
  private val pinAccounts by lazy { PinAccounts(vault, keys, deviceKey) }
  private val random = SecureRandom()

  override fun definition() = ModuleDefinition {
    Name("CryptoAndKeys")

    AsyncFunction("ensureKeys") {
      keys.ensure()
    }

    AsyncFunction("openViewing") {
      keys.openViewing()
    }

    AsyncFunction("closeViewing") {
      keys.closeViewing()
    }

    AsyncFunction("storageDirectory") { domain: KeyDomain ->
      vault.directory(domain).absolutePath
    }

    AsyncFunction("databaseKey") { domain: KeyDomain ->
      databaseKey(domain)
    }

    AsyncFunction("setStorageAside") { domain: KeyDomain ->
      setStorageAside(domain)
    }

    AsyncFunction("encryptFile") { sourcePath: String, domain: KeyDomain ->
      val plaintext = vault.read(sourcePath)
      val stored = files.store(plaintext, domain)
      vault.remove(sourcePath)
      stored
    }

    AsyncFunction("encryptBytes") { data: ByteArray, domain: KeyDomain ->
      files.store(data, domain)
    }

    AsyncFunction("decryptFile") { path: String, wrappedKey: String, domain: KeyDomain ->
      files.open(path, wrappedKey, domain)
    }

    AsyncFunction("removeFile") { path: String ->
      vault.remove(path)
    }

    AsyncFunction("sealForServer") { path: String, wrappedKey: String, domain: KeyDomain, serverKey: ServerHpkeKey ->
      sealForServer(path, wrappedKey, domain, serverKey)
    }

    AsyncFunction("deviceKey") {
      deviceKey.info()
    }

    AsyncFunction("signJws") { headerJson: String, payloadJson: String ->
      deviceKey.signJws(headerJson, payloadJson)
    }

    AsyncFunction("approvalFingerprint") {
      deviceKey.approvalFingerprint()
    }

    AsyncFunction("sha256Text") { text: String ->
      Base64.encodeToString(MessageDigest.getInstance(SHA_256).digest(text.toByteArray()), BASE64_URL)
    }

    AsyncFunction("randomIdentifier") {
      Base64.encodeToString(ByteArray(RANDOM_IDENTIFIER_BYTES).also { random.nextBytes(it) }, BASE64_URL)
    }

    AsyncFunction("deviceDescriptor") {
      DeviceDescriptor().apply {
        model = Build.MODEL
        osVersion = Build.VERSION.RELEASE
      }
    }

    AsyncFunction("preparePin") { pin: String ->
      pinAccounts.prepare(pin)
    }

    AsyncFunction("commitPin") { setupId: String, personalNumber: String, displayName: String ->
      pinAccounts.commit(setupId, personalNumber, displayName)
    }

    AsyncFunction("discardPin") { setupId: String ->
      pinAccounts.discard(setupId)
    }

    AsyncFunction("pinProof") { personalNumber: String, pin: String, challenge: PinProofChallenge ->
      pinAccounts.proof(personalNumber, pin, challenge)
    }

    AsyncFunction("pinAccount") { personalNumber: String ->
      pinAccounts.account(personalNumber)
    }

    AsyncFunction("renamePinAccount") { personalNumber: String, displayName: String ->
      pinAccounts.rename(personalNumber, displayName)
    }

    AsyncFunction("currentPinAccount") {
      pinAccounts.current()
    }

    AsyncFunction("setCurrentPinAccount") { personalNumber: String, sessionEnd: String ->
      pinAccounts.setCurrent(personalNumber, sessionEnd)
    }

    // CAP-007-R04, CAP-009-R14
    AsyncFunction("eraseLocalData") {
      eraseLocalData()
    }

    // CAP-025-R22
    AsyncFunction("forgetDeviceKey") {
      deviceKey.forget()
    }
  }

  // CAP-009-R13, CAP-009-R05
  private fun sealForServer(path: String, wrappedKey: String, domain: KeyDomain, serverKey: ServerHpkeKey): SealedCopy {
    val recipient = try {
      Base64.decode(serverKey.publicKey, BASE64_URL)
    } catch (invalid: IllegalArgumentException) {
      throw ServerKeyInvalidException()
    }
    val plaintext = files.open(path, wrappedKey, domain)
    val sealed = try {
      Hpke.seal(plaintext, recipient)
    } catch (invalid: Hpke.InvalidRecipientKeyException) {
      throw ServerKeyInvalidException()
    }
    val file = vault.write(sealed.ciphertext, domain)
    return SealedCopy().apply {
      this.path = file.absolutePath
      enc = Base64.encodeToString(sealed.enc, BASE64_URL)
      suite = Hpke.SUITE
      serverKeyVersion = serverKey.serverKeyVersion
      sha256 = hex(MessageDigest.getInstance(SHA_256).digest(plaintext))
    }
  }

  // CAP-009-S05, Q-076
  @Synchronized
  private fun databaseKey(domain: KeyDomain): String {
    val master = keys.key(domain)
    val file = File(vault.directory(domain), DATABASE_KEY_FILE_NAME)
    vault.readIfPresent(file)?.let { wrapped ->
      return try {
        hex(FileCipher.unwrap(wrapped, master))
      } catch (invalid: FileKeyInvalidException) {
        throw KeyInvalidatedException()
      }
    }
    val raw = ByteArray(DATABASE_KEY_BYTES).also { random.nextBytes(it) }
    vault.write(FileCipher.wrap(raw, master), file)
    return hex(raw)
  }

  // CAP-007-R04, CAP-009-R14
  @Synchronized
  private fun eraseLocalData() {
    keys.forgetAll()
    vault.eraseAll()
  }

  // CAP-009-S05, ADR-038, Q-076
  @Synchronized
  private fun setStorageAside(domain: KeyDomain) {
    keys.forgetUnusable(domain)
    vault.setAside(domain, System.currentTimeMillis())
  }
}

internal fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }

class DeviceKey {
  private var privateKey: PrivateKey? = null

  @Synchronized
  fun info(): DeviceKeyInfo {
    val key = key()
    val publicKey = KeyStore.getInstance(KEY_STORE).apply { load(null) }.getCertificate(DEVICE_KEY_ALIAS).publicKey as ECPublicKey
    return DeviceKeyInfo().apply {
      publicKeyJwk = jwk(publicKey)
      secureHardware = secureHardware(key)
    }
  }

  @Synchronized
  fun signJws(header: String, payload: String): String {
    val signingInput = base64Url(header.toByteArray()) + "." + base64Url(payload.toByteArray())
    val signature = Signature.getInstance(SIGNATURE_ALGORITHM).apply {
      initSign(key())
      update(signingInput.toByteArray())
    }.sign()
    return signingInput + "." + base64Url(EcdsaSignature.raw(signature))
  }

  @Synchronized
  fun thumbprint(): String {
    key()
    val publicKey = KeyStore.getInstance(KEY_STORE).apply { load(null) }.getCertificate(DEVICE_KEY_ALIAS).publicKey as ECPublicKey
    val jwk = jwk(publicKey)
    val canonical = """{"crv":"${jwk["crv"]}","kty":"${jwk["kty"]}","x":"${jwk["x"]}","y":"${jwk["y"]}"}"""
    return base64Url(MessageDigest.getInstance(SHA_256).digest(canonical.toByteArray()))
  }

  // CAP-025-R22
  @Synchronized
  fun forget() {
    privateKey = null
    val store = KeyStore.getInstance(KEY_STORE).apply { load(null) }
    if (store.containsAlias(DEVICE_KEY_ALIAS)) {
      store.deleteEntry(DEVICE_KEY_ALIAS)
    }
  }

  @Synchronized
  fun approvalFingerprint(): String {
    key()
    val encoded = KeyStore.getInstance(KEY_STORE).apply { load(null) }.getCertificate(DEVICE_KEY_ALIAS).publicKey.encoded
    val digest = MessageDigest.getInstance(SHA_256).digest(encoded)
    val characters = crockfordBase32(digest, FINGERPRINT_BITS)
    return characters.substring(0, FINGERPRINT_GROUP) + "-" + characters.substring(FINGERPRINT_GROUP)
  }

  private fun key(): PrivateKey {
    privateKey?.let { return it }
    val keyStore = KeyStore.getInstance(KEY_STORE).apply { load(null) }
    val existing = keyStore.getKey(DEVICE_KEY_ALIAS, null) as? PrivateKey
    val key = existing ?: generate()
    privateKey = key
    return key
  }

  private fun generate(): PrivateKey {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      generateStrongBox()?.let { return it }
    }
    return generateWith(specBuilder().build())
  }

  @TargetApi(Build.VERSION_CODES.P)
  private fun generateStrongBox(): PrivateKey? =
    try {
      generateWith(specBuilder().setIsStrongBoxBacked(true).build())
    } catch (unavailable: StrongBoxUnavailableException) {
      null
    }

  private fun specBuilder(): KeyGenParameterSpec.Builder {
    val builder = KeyGenParameterSpec.Builder(DEVICE_KEY_ALIAS, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
      .setAlgorithmParameterSpec(ECGenParameterSpec(ELLIPTIC_CURVE))
      .setDigests(KeyProperties.DIGEST_SHA256)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      builder.setUnlockedDeviceRequired(false)
    }
    return builder
  }

  private fun generateWith(spec: KeyGenParameterSpec): PrivateKey {
    val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEY_STORE)
    generator.initialize(spec)
    return generator.generateKeyPair().private
  }

  @Suppress("DEPRECATION")
  private fun secureHardware(key: PrivateKey): String {
    val info = KeyFactory.getInstance(key.algorithm, KEY_STORE).getKeySpec(key, KeyInfo::class.java) as KeyInfo
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      return when (info.securityLevel) {
        KeyProperties.SECURITY_LEVEL_STRONGBOX -> "strongbox"
        KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT -> "keystore"
        else -> "unknown"
      }
    }
    return if (info.isInsideSecureHardware) "keystore" else "unknown"
  }

  private fun jwk(publicKey: ECPublicKey): Map<String, String> =
    mapOf(
      "kty" to "EC",
      "crv" to "P-256",
      "x" to base64Url(coordinate(publicKey.w.affineX)),
      "y" to base64Url(coordinate(publicKey.w.affineY)),
    )

  private fun coordinate(value: BigInteger): ByteArray {
    val bytes = value.toByteArray().dropWhile { it == 0.toByte() }
    return ByteArray(ELLIPTIC_COORDINATE_BYTES - bytes.size) + bytes.toByteArray()
  }

  private fun base64Url(bytes: ByteArray): String = Base64.encodeToString(bytes, BASE64_URL)
}

fun crockfordBase32(digest: ByteArray, bits: Int): String {
  val out = StringBuilder()
  var bit = 0
  while (bit < bits) {
    out.append(CROCKFORD_ALPHABET[readBits(digest, bit, BITS_PER_CHARACTER)])
    bit += BITS_PER_CHARACTER
  }
  return out.toString()
}

private fun readBits(digest: ByteArray, offset: Int, count: Int): Int {
  var value = 0
  repeat(count) { index ->
    val bit = offset + index
    val byte = digest[bit shr 3].toInt() and 0xff
    value = (value shl 1) or ((byte shr (7 - (bit and 7))) and 1)
  }
  return value
}

object EcdsaSignature {
  private const val SEQUENCE_TAG = 0x30
  private const val INTEGER_TAG = 0x02

  fun raw(der: ByteArray): ByteArray {
    val reader = DerReader(der)
    if (reader.readByte() != SEQUENCE_TAG) {
      throw SignatureInvalidException()
    }
    reader.readLength()
    return readInteger(reader) + readInteger(reader)
  }

  private fun readInteger(reader: DerReader): ByteArray {
    if (reader.readByte() != INTEGER_TAG) {
      throw SignatureInvalidException()
    }
    val value = reader.readBytes(reader.readLength()).dropWhile { it == 0.toByte() }
    if (value.size > ELLIPTIC_COORDINATE_BYTES) {
      throw SignatureInvalidException()
    }
    return ByteArray(ELLIPTIC_COORDINATE_BYTES - value.size) + value.toByteArray()
  }
}

class DerReader(private val bytes: ByteArray) {
  private var offset = 0

  fun readByte(): Int {
    if (offset >= bytes.size) {
      throw SignatureInvalidException()
    }
    return bytes[offset++].toInt() and 0xff
  }

  fun readLength(): Int {
    val first = readByte()
    if (first and 0x80 == 0) {
      return first
    }
    val lengthBytes = first and 0x7f
    if (lengthBytes == 0 || lengthBytes > 2) {
      throw SignatureInvalidException()
    }
    var length = 0
    repeat(lengthBytes) {
      length = length shl 8 or readByte()
    }
    return length
  }

  fun readBytes(count: Int): ByteArray {
    if (count < 0 || offset + count > bytes.size) {
      throw SignatureInvalidException()
    }
    return bytes.copyOfRange(offset, offset + count).also { offset += count }
  }
}

object FileCipher {
  class Sealed(val ciphertext: ByteArray, val wrappedKey: ByteArray)

  fun seal(plaintext: ByteArray, master: SecretKey): Sealed {
    val fileKey = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES).apply { init(AES_KEY_BITS) }.generateKey()
    return Sealed(encrypt(plaintext, fileKey), wrap(fileKey.encoded, master))
  }

  fun open(ciphertext: ByteArray, wrappedKey: ByteArray, master: SecretKey): ByteArray {
    val fileKey = SecretKeySpec(unwrap(wrappedKey, master), KeyProperties.KEY_ALGORITHM_AES)
    return openWith(ciphertext, fileKey)
  }

  fun wrap(key: ByteArray, master: SecretKey): ByteArray = encrypt(key, master)

  fun unwrap(wrapped: ByteArray, master: SecretKey): ByteArray = openWith(wrapped, master)

  private fun openWith(sealed: ByteArray, key: SecretKey): ByteArray =
    try {
      decrypt(sealed, key)
    } catch (badTag: AEADBadTagException) {
      throw FileKeyInvalidException()
    } catch (malformed: IllegalArgumentException) {
      throw FileKeyInvalidException()
    }

  private fun encrypt(plaintext: ByteArray, key: SecretKey): ByteArray {
    val cipher = Cipher.getInstance(GCM_TRANSFORMATION)
    initialized { cipher.init(Cipher.ENCRYPT_MODE, key) }
    return cipher.iv + cipher.doFinal(plaintext)
  }

  private fun decrypt(sealed: ByteArray, key: SecretKey): ByteArray {
    if (sealed.size < GCM_NONCE_BYTES) {
      throw FileKeyInvalidException()
    }
    val cipher = Cipher.getInstance(GCM_TRANSFORMATION)
    initialized { cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, sealed, 0, GCM_NONCE_BYTES)) }
    return cipher.doFinal(sealed, GCM_NONCE_BYTES, sealed.size - GCM_NONCE_BYTES)
  }

  // CAP-009-S05, Q-076
  private fun initialized(initialize: () -> Unit) {
    try {
      initialize()
    } catch (invalidated: KeyPermanentlyInvalidatedException) {
      throw KeyInvalidatedException()
    }
  }
}

class EncryptedFiles(val vault: Vault, private val keys: MasterKeys) {
  fun store(plaintext: ByteArray, domain: KeyDomain): EncryptedFile {
    val sealed = FileCipher.seal(plaintext, keys.key(domain))
    val file = vault.write(sealed.ciphertext, domain)
    return EncryptedFile().apply {
      path = file.absolutePath
      wrappedKey = Base64.encodeToString(sealed.wrappedKey, Base64.NO_WRAP)
    }
  }

  fun open(path: String, wrappedKey: String, domain: KeyDomain): ByteArray {
    val wrapped = decodedWrappedKey(wrappedKey)
    val master = keys.key(domain)
    return FileCipher.open(vault.read(path), wrapped, master)
  }

  private fun decodedWrappedKey(wrappedKey: String): ByteArray =
    try {
      Base64.decode(wrappedKey, Base64.NO_WRAP)
    } catch (invalid: IllegalArgumentException) {
      throw FileKeyInvalidException()
    }
}

class Vault(private val context: Context) {
  fun write(data: ByteArray, domain: KeyDomain): File {
    val file = File(directory(domain), UUID.randomUUID().toString())
    write(data, file)
    return file
  }

  fun write(data: ByteArray, file: File) {
    val staging = File(file.parentFile, file.name + ".part")
    try {
      staging.writeBytes(data)
    } catch (failure: IOException) {
      staging.delete()
      if (failure.message?.contains(NO_SPACE_LEFT) == true) {
        throw StorageFullException()
      }
      throw failure
    }
    if (!staging.renameTo(file)) {
      staging.delete()
      throw IOException("Cannot move the encrypted file into place")
    }
  }

  fun read(path: String): ByteArray {
    val file = File(path)
    if (!file.isFile) {
      throw FileUnavailableException(path)
    }
    return file.readBytes()
  }

  fun readIfPresent(file: File): ByteArray? = if (file.isFile) file.readBytes() else null

  fun remove(path: String) {
    val file = File(path)
    if (file.exists() && !file.delete()) {
      throw IOException("Cannot remove the file at $path")
    }
  }

  fun directory(domain: KeyDomain): File = VaultLayout.directory(context, domain.value)

  // CAP-009-S05, ADR-038, Q-076
  fun setAside(domain: KeyDomain, atMs: Long) {
    VaultLayout.setAside(File(VaultLayout.root(context), domain.value), atMs)
  }

  // CAP-007-R04, CAP-009-R14, CAP-010-R06
  fun eraseAll() {
    VaultLayout.eraseAll(context, setOf(PINS_FILE_NAME))
  }
}

class MasterKeys {
  private var viewingOpen = false

  @Synchronized
  fun ensure(): KeyProtection {
    KeyDomain.values().forEach { storedKey(it) }
    return protectionOf(storedKey(KeyDomain.QUEUE))
  }

  @Synchronized
  fun openViewing() {
    storedKey(KeyDomain.VIEWING)
    viewingOpen = true
  }

  @Synchronized
  fun closeViewing() {
    viewingOpen = false
  }

  @Synchronized
  fun key(domain: KeyDomain): SecretKey {
    if (domain == KeyDomain.VIEWING && !viewingOpen) {
      throw ViewingKeyLockedException()
    }
    return storedKey(domain)
  }

  // CAP-007-R04, CAP-009-R14
  @Synchronized
  fun forgetAll() {
    viewingOpen = false
    val store = keyStore()
    KeyDomain.values().filter { store.containsAlias(it.alias) }.forEach { store.deleteEntry(it.alias) }
  }

  // CAP-009-S05, Q-076
  @Synchronized
  fun forgetUnusable(domain: KeyDomain) {
    if (domain == KeyDomain.VIEWING) {
      viewingOpen = false
    }
    if (isUnusable(domain)) {
      keyStore().deleteEntry(domain.alias)
    }
  }

  private fun storedKey(domain: KeyDomain): SecretKey {
    existingKey(domain)?.let { return it }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      createStrongBoxKey(domain)?.let { return it }
    }
    return generateKey(specBuilder(domain).build())
  }

  // CAP-009-S05, Q-076
  private fun existingKey(domain: KeyDomain): SecretKey? =
    try {
      keyStore().getKey(domain.alias, null) as? SecretKey
    } catch (unrecoverable: UnrecoverableKeyException) {
      throw KeyInvalidatedException()
    }

  private fun isUnusable(domain: KeyDomain): Boolean =
    try {
      existingKey(domain)?.let { Cipher.getInstance(GCM_TRANSFORMATION).init(Cipher.ENCRYPT_MODE, it) }
      false
    } catch (invalidated: KeyInvalidatedException) {
      true
    } catch (invalidated: KeyPermanentlyInvalidatedException) {
      true
    }

  private fun keyStore(): KeyStore = KeyStore.getInstance(KEY_STORE).apply { load(null) }

  @TargetApi(Build.VERSION_CODES.P)
  private fun createStrongBoxKey(domain: KeyDomain): SecretKey? {
    val spec = specBuilder(domain).setIsStrongBoxBacked(true).build()
    return try {
      generateKey(spec)
    } catch (unavailable: StrongBoxUnavailableException) {
      null
    }
  }

  private fun specBuilder(domain: KeyDomain): KeyGenParameterSpec.Builder {
    val builder = KeyGenParameterSpec.Builder(domain.alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(AES_KEY_BITS)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      builder.setUnlockedDeviceRequired(domain.requiresUnlockedDevice)
    }
    return builder
  }

  private fun generateKey(spec: KeyGenParameterSpec): SecretKey {
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEY_STORE)
    generator.init(spec)
    return generator.generateKey()
  }

  @Suppress("DEPRECATION")
  private fun protectionOf(key: SecretKey): KeyProtection {
    val info = SecretKeyFactory.getInstance(key.algorithm, KEY_STORE).getKeySpec(key, KeyInfo::class.java) as KeyInfo
    return KeyProtection().apply {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        secureElement = info.securityLevel == KeyProperties.SECURITY_LEVEL_STRONGBOX
        hardwareBacked = secureElement || info.securityLevel == KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT
      } else {
        hardwareBacked = info.isInsideSecureHardware
      }
    }
  }
}
