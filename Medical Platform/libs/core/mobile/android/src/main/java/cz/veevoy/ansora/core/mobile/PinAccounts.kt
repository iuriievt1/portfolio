package cz.veevoy.ansora.core.mobile

import android.os.Build
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.Signature
import org.json.JSONObject

class PinAccount : Record {
  @Field var displayName: String = ""
}

class PinSetup : Record {
  @Field var setupId: String = ""
  @Field var pinProofSetup: String = ""
}

class PinProofChallenge : Record {
  @Field var challengeId: String = ""
  @Field var value: String = ""
  @Field var issuedAt: Int = 0
}

class CurrentPinAccount : Record {
  @Field var personalNumber: String = ""
  @Field var displayName: String = ""
  @Field var sessionEnd: String = ""
}

class PinAccountMissingException :
  CodedException("pin-account-missing", "No local account with a PIN exists for this personal number", null)

class PinSetupMissingException :
  CodedException("pin-setup-missing", "No prepared PIN exists under this setup id", null)

class PinInvalidException : CodedException("pin-invalid", "The PIN is not 4 to 8 digits", null)

class PinUnsupportedException :
  CodedException("pin-unsupported", "Ed25519 needs Android 13 or newer", null)

internal class PinAccounts(private val vault: Vault, private val keys: MasterKeys, private val deviceKey: DeviceKey) {
  companion object {
    val KEY_PARAMETERS = Argon2.Parameters(memoryKiB = 65_536, passes = 3, parallelism = 1, tagLength = 32)
    const val SALT_BYTES = 16
    val PIN_PATTERN = Regex("^[0-9]{4,8}$")

    private const val DIRECTORY_NAME = "pin-accounts"
    private const val PENDING_DIRECTORY_NAME = "pending"
    private const val CURRENT_FILE_NAME = "current"
    private const val MARKER_PERSONAL_NUMBER = "personal_number"
    private const val MARKER_SESSION_END = "session_end"
    private const val SIGNATURE_ALGORITHM = "Ed25519"
    private const val PROOF_ALGORITHM = "EdDSA"
    private const val PROOF_TYPE = "JWT"
    private const val PUBLIC_KEY_TYPE = "OKP"
    private const val PUBLIC_KEY_CURVE = "Ed25519"
    private const val BASE64_URL = Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING
    private const val ED25519_SDK = Build.VERSION_CODES.TIRAMISU
  }

  private class StoredAccount(var personalNumber: String, var displayName: String, val salt: ByteArray, val sealedSeed: ByteArray, val createdAt: String) {
    fun toJson(): String = JSONObject()
      .put("personal_number", personalNumber)
      .put("display_name", displayName)
      .put("salt", Base64.encodeToString(salt, Base64.NO_WRAP))
      .put("sealed_seed", Base64.encodeToString(sealedSeed, Base64.NO_WRAP))
      .put("created_at", createdAt)
      .toString()

    companion object {
      fun fromJson(text: String): StoredAccount {
        val json = JSONObject(text)
        return StoredAccount(
          json.getString("personal_number"),
          json.getString("display_name"),
          Base64.decode(json.getString("salt"), Base64.NO_WRAP),
          Base64.decode(json.getString("sealed_seed"), Base64.NO_WRAP),
          json.getString("created_at"),
        )
      }
    }
  }

  private val random = SecureRandom()

  @Synchronized
  fun prepare(pin: String): PinSetup {
    checkPin(pin)
    checkPlatform()
    val seed = ByteArray(Ed25519.SEED_BYTES).also { random.nextBytes(it) }
    val salt = ByteArray(SALT_BYTES).also { random.nextBytes(it) }
    val pinKey = pinKey(pin, salt)
    try {
      pendingDirectory().listFiles()?.forEach { vault.remove(it.absolutePath) }
      val setupId = java.util.UUID.randomUUID().toString()
      write(StoredAccount("", "", salt, xor(seed, pinKey), java.time.Instant.now().toString()), File(pendingDirectory(), setupId))
      val publicKey = Ed25519.publicKeyBytes(seed)
      return PinSetup().apply {
        this.setupId = setupId
        pinProofSetup = JSONObject()
          .put("kty", PUBLIC_KEY_TYPE)
          .put("crv", PUBLIC_KEY_CURVE)
          .put("x", Base64.encodeToString(publicKey, BASE64_URL))
          .toString()
      }
    } finally {
      seed.fill(0)
      pinKey.fill(0)
    }
  }

  @Synchronized
  fun commit(setupId: String, personalNumber: String, displayName: String) {
    val pending = File(pendingDirectory(), setupId)
    val account = read(pending) ?: throw PinSetupMissingException()
    account.personalNumber = personalNumber
    account.displayName = displayName
    write(account, file(personalNumber))
    vault.remove(pending.absolutePath)
  }

  @Synchronized
  fun discard(setupId: String) {
    vault.remove(File(pendingDirectory(), setupId).absolutePath)
  }

  @Synchronized
  fun proof(personalNumber: String, pin: String, challenge: PinProofChallenge): String {
    checkPin(pin)
    checkPlatform()
    val account = read(file(personalNumber)) ?: throw PinAccountMissingException()
    val pinKey = pinKey(pin, account.salt)
    val seed = xor(account.sealedSeed, pinKey)
    try {
      val payload = JSONObject()
        .put("challenge_id", challenge.challengeId)
        .put("value", challenge.value)
        .put("personal_number", personalNumber)
        .put("jkt", deviceKey.thumbprint())
        .put("iat", challenge.issuedAt)
        .toString()
      val header = JSONObject().put("alg", PROOF_ALGORITHM).put("typ", PROOF_TYPE).toString()
      val signingInput = base64Url(header.toByteArray()) + "." + base64Url(payload.toByteArray())
      val signature = Signature.getInstance(SIGNATURE_ALGORITHM).apply {
        initSign(Ed25519.privateKey(seed))
        update(signingInput.toByteArray())
      }.sign()
      return signingInput + "." + base64Url(signature)
    } finally {
      seed.fill(0)
      pinKey.fill(0)
    }
  }

  @Synchronized
  fun account(personalNumber: String): PinAccount? =
    read(file(personalNumber))?.let { stored -> PinAccount().apply { displayName = stored.displayName } }

  @Synchronized
  fun rename(personalNumber: String, displayName: String) {
    val stored = read(file(personalNumber)) ?: throw PinAccountMissingException()
    stored.displayName = displayName
    write(stored, file(personalNumber))
  }

  @Synchronized
  fun current(): CurrentPinAccount? {
    val marker = readMarker() ?: return null
    val stored = read(file(marker.getString(MARKER_PERSONAL_NUMBER))) ?: return null
    return CurrentPinAccount().apply {
      personalNumber = stored.personalNumber
      displayName = stored.displayName
      sessionEnd = marker.optString(MARKER_SESSION_END, "")
    }
  }

  @Synchronized
  fun setCurrent(personalNumber: String, sessionEnd: String) {
    read(file(personalNumber)) ?: throw PinAccountMissingException()
    val marker = JSONObject().put(MARKER_PERSONAL_NUMBER, personalNumber).put(MARKER_SESSION_END, sessionEnd)
    seal(marker.toString(), currentFile())
  }

  private fun read(file: File): StoredAccount? = open(file)?.let { StoredAccount.fromJson(it) }

  private fun readMarker(): JSONObject? = open(currentFile())?.let { JSONObject(it) }

  private fun open(file: File): String? {
    val sealed = vault.readIfPresent(file) ?: return null
    return String(FileCipher.unwrap(sealed, keys.key(KeyDomain.QUEUE)))
  }

  private fun seal(json: String, file: File) {
    vault.write(FileCipher.wrap(json.toByteArray(), keys.key(KeyDomain.QUEUE)), file)
  }

  private fun currentFile(): File = File(directory(), CURRENT_FILE_NAME)

  private fun write(account: StoredAccount, file: File) = seal(account.toJson(), file)

  private fun file(personalNumber: String): File {
    val digest = MessageDigest.getInstance(SHA_256).digest(personalNumber.toByteArray())
    return File(directory(), digest.joinToString("") { "%02x".format(it) })
  }

  private fun directory(): File = File(vault.directory(KeyDomain.QUEUE), DIRECTORY_NAME).also { it.mkdirs() }

  private fun pendingDirectory(): File = File(directory(), PENDING_DIRECTORY_NAME).also { it.mkdirs() }

  private fun pinKey(pin: String, salt: ByteArray): ByteArray = Argon2.hash(pin.toByteArray(), salt, parameters = KEY_PARAMETERS)

  private fun checkPin(pin: String) {
    if (!PIN_PATTERN.matches(pin)) {
      throw PinInvalidException()
    }
  }

  private fun checkPlatform() {
    if (Build.VERSION.SDK_INT < ED25519_SDK) {
      throw PinUnsupportedException()
    }
  }

  private fun xor(left: ByteArray, right: ByteArray): ByteArray = ByteArray(left.size) { (left[it].toInt() xor right[it].toInt()).toByte() }

  private fun base64Url(bytes: ByteArray): String = Base64.encodeToString(bytes, BASE64_URL)
}
