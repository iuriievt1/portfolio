package cz.veevoy.ansora.core.mobile

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.os.Build
import android.os.Debug
import android.system.ErrnoException
import android.system.Os
import android.util.Log
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

// CAP-008-R01, CAP-008-R08
class DeviceIntegrityEvidence(private val context: Context) : IntegrityEvidence {
  private var cachedProperties: Map<String, String> = emptyMap()

  override val build = BuildFacts(
    fingerprint = Build.FINGERPRINT,
    hardware = Build.HARDWARE,
    product = Build.PRODUCT,
    model = Build.MODEL,
    manufacturer = Build.MANUFACTURER,
  )

  override val pathDirectories: List<String> =
    System.getenv(PATH).orEmpty().split(File.pathSeparatorChar).filter { it.isNotEmpty() }

  override val ownCodeDirectory: String = File(context.applicationInfo.sourceDir).parent.orEmpty()

  override fun exists(path: String): Boolean =
    try {
      File(path).exists()
    } catch (denied: SecurityException) {
      false
    }

  @Synchronized
  override fun systemProperties(): Map<String, String> {
    if (cachedProperties.isNotEmpty()) {
      return cachedProperties
    }
    cachedProperties = readSystemProperties()
    return cachedProperties
  }

  override fun read(path: String): String? =
    try {
      File(path).readText()
    } catch (unreadable: IOException) {
      null
    } catch (denied: SecurityException) {
      null
    }

  override fun threadNames(): List<String> =
    File(TASKS).listFiles()?.mapNotNull { read(File(it, THREAD_NAME).path)?.trim() }.orEmpty()

  override fun descriptorTargets(): List<String> =
    File(DESCRIPTORS).listFiles()?.mapNotNull(::linkTarget).orEmpty()

  override fun isInstalled(packageName: String): Boolean =
    try {
      packageInfo(packageName, NO_FLAGS)
      true
    } catch (absent: PackageManager.NameNotFoundException) {
      false
    }

  override fun isDebuggerAttached(): Boolean = Debug.isDebuggerConnected() || Debug.waitingForDebugger()

  override fun isDebuggable(): Boolean = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

  override fun signerDigests(): Set<String>? =
    try {
      signatures().map(::digestOf).toSet()
    } catch (absent: PackageManager.NameNotFoundException) {
      Log.w(OS_INTEGRITY_LOG_TAG, "The signature of the app could not be read", absent)
      null
    }

  private fun linkTarget(descriptor: File): String? =
    try {
      Os.readlink(descriptor.path)
    } catch (gone: ErrnoException) {
      null
    }

  private fun digestOf(signature: Signature): String =
    hex(MessageDigest.getInstance(SHA_256).digest(signature.toByteArray()))

  private fun signatures(): List<Signature> {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val signing = packageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES).signingInfo ?: return emptyList()
      val signers = if (signing.hasMultipleSigners()) signing.apkContentsSigners else signing.signingCertificateHistory
      return signers.orEmpty().toList()
    }
    return legacySignatures()
  }

  @Suppress("DEPRECATION")
  private fun legacySignatures(): List<Signature> =
    packageInfo(context.packageName, PackageManager.GET_SIGNATURES).signatures.orEmpty().toList()

  private fun packageInfo(packageName: String, flags: Int): PackageInfo {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      return context.packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(flags.toLong()))
    }
    return legacyPackageInfo(packageName, flags)
  }

  @Suppress("DEPRECATION")
  private fun legacyPackageInfo(packageName: String, flags: Int): PackageInfo =
    context.packageManager.getPackageInfo(packageName, flags)

  private fun readSystemProperties(): Map<String, String> {
    val process = startGetprop() ?: return emptyMap()
    try {
      return outputOf(process).lineSequence().mapNotNull(::propertyOf).toMap()
    } finally {
      process.destroy()
    }
  }

  private fun startGetprop(): Process? =
    try {
      ProcessBuilder(GETPROP).redirectErrorStream(true).start()
    } catch (failed: IOException) {
      Log.w(OS_INTEGRITY_LOG_TAG, "The system properties could not be read", failed)
      null
    }

  private fun outputOf(process: Process): String =
    try {
      CompletableFuture
        .supplyAsync { process.inputStream.bufferedReader().use { it.readText() } }
        .get(GETPROP_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    } catch (late: TimeoutException) {
      Log.w(OS_INTEGRITY_LOG_TAG, "The system properties were not read in time", late)
      NO_OUTPUT
    } catch (failed: ExecutionException) {
      Log.w(OS_INTEGRITY_LOG_TAG, "The system properties could not be read", failed)
      NO_OUTPUT
    } catch (interrupted: InterruptedException) {
      Thread.currentThread().interrupt()
      NO_OUTPUT
    }

  private fun propertyOf(line: String): Pair<String, String>? {
    val match = PROPERTY_LINE.matchEntire(line.trim()) ?: return null
    return match.groupValues[1] to match.groupValues[2]
  }

  private companion object {
    const val PATH = "PATH"
    const val TASKS = "/proc/self/task"
    const val THREAD_NAME = "comm"
    const val DESCRIPTORS = "/proc/self/fd"
    const val NO_FLAGS = 0
    const val GETPROP = "getprop"
    const val GETPROP_TIMEOUT_SECONDS = 2L
    const val NO_OUTPUT = ""
    val PROPERTY_LINE = Regex("""^\[(.+?)]: \[(.*)]$""")
  }
}
