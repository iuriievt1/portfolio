package cz.veevoy.ansora.core.mobile

import java.io.File

// CAP-008-R02, identity.yaml IntegrityReport
enum class IntegritySignal(val wire: String) {
  ROOT("root"),
  MAGISK("magisk"),
  FRIDA("frida"),
  DEBUGGER("debugger"),
  EMULATOR("emulator"),
  APP_INTEGRITY("app_integrity"),
}

data class BuildFacts(
  val fingerprint: String,
  val hardware: String,
  val product: String,
  val model: String,
  val manufacturer: String,
)

interface IntegrityEvidence {
  val build: BuildFacts
  val pathDirectories: List<String>
  val ownCodeDirectory: String

  fun exists(path: String): Boolean

  fun systemProperties(): Map<String, String>

  fun read(path: String): String?

  fun threadNames(): List<String>

  fun descriptorTargets(): List<String>

  fun isInstalled(packageName: String): Boolean

  fun isDebuggerAttached(): Boolean

  fun isDebuggable(): Boolean

  fun signerDigests(): Set<String>?
}

class IntegrityPolicy(val isDevelopmentBuild: Boolean, val expectedSignerDigests: Set<String>)

// CAP-008-R01, CAP-008-R02, CAP-008-R10, zarizeni-a-sifrovani.md 3
object IntegrityDetection {
  private val SU_PATHS = listOf(
    "/system/bin/su",
    "/system/xbin/su",
    "/sbin/su",
    "/su/bin/su",
    "/system/sd/xbin/su",
    "/system/bin/failsafe/su",
    "/data/local/su",
    "/data/local/bin/su",
    "/data/local/xbin/su",
    "/vendor/bin/su",
    "/product/bin/su",
    "/system/xbin/daemonsu",
    "/system/app/Superuser.apk",
    "/system/app/SuperSU.apk",
    "/system/etc/init.d/99SuperSUDaemon",
  )
  private const val SU = "su"
  val ROOT_MANAGERS = listOf(
    "eu.chainfire.supersu",
    "com.noshufou.android.su",
    "com.noshufou.android.su.elite",
    "com.koushikdutta.superuser",
    "com.thirdparty.superuser",
    "com.yellowes.su",
    "com.kingroot.kinguser",
    "com.kingo.root",
    "com.smedialink.oneclickroot",
    "com.zhiqupk.root.global",
    "com.alephzain.framaroot",
  )

  private const val VERIFIED_BOOT_STATE = "ro.boot.verifiedbootstate"
  private const val FLASH_LOCKED = "ro.boot.flash.locked"
  private const val VBMETA_DEVICE_STATE = "ro.boot.vbmeta.device_state"
  private val KNOX_WARRANTY_PROPERTIES = listOf("ro.boot.warranty_bit", "ro.warranty_bit")
  private const val SECURE = "ro.secure"
  private const val DEBUGGABLE = "ro.debuggable"
  private const val SELINUX = "ro.boot.selinux"
  private const val UNLOCKED_BOOT_STATE = "orange"
  private const val UNLOCKED_FLASH = "0"
  private const val UNLOCKED_VBMETA = "unlocked"
  private const val TRIPPED = "1"
  private const val INSECURE_BUILD = "0"
  private const val DEBUGGABLE_BUILD = "1"
  private const val PERMISSIVE_SELINUX = "permissive"

  private val SYSTEM_MOUNT_POINTS = setOf("/system", "/")
  private val SYSTEM_FILESYSTEMS = setOf("ext4", "f2fs")
  private const val READ_WRITE = "rw"
  private const val MOUNT_FIELD_SEPARATOR = ' '
  private const val MOUNT_OPTION_SEPARATOR = ','
  private const val MOUNT_FIELDS = 4

  private val MAGISK_PATHS = listOf(
    "/sbin/.magisk",
    "/sbin/.core/mirror",
    "/sbin/.core/img",
    "/cache/.disable_magisk",
    "/cache/magisk.log",
    "/dev/.magisk.unblock",
    "/data/adb/magisk",
    "/data/adb/magisk.db",
    "/data/adb/modules",
    "/data/adb/ksu",
    "/data/adb/ksud",
    "/data/adb/ap",
    "/data/adb/apd",
    "/debug_ramdisk/magisk",
    "/system/bin/magisk",
  )
  val MAGISK_MANAGERS = listOf(
    "com.topjohnwu.magisk",
    "io.github.vvb2060.magisk",
    "io.github.huskydg.magisk",
    "me.weishu.kernelsu",
    "com.rifsxd.ksunext",
    "me.bmax.apatch",
  )
  private val MAGISK_MOUNT_SOURCES = setOf("magisk", "ksu", "apatch")
  private val MAGISK_LIBRARY_MARKERS = listOf("magisk", "zygisk")

  private val FRIDA_PATHS = listOf(
    "/data/local/tmp/frida-server",
    "/data/local/tmp/re.frida.server",
    "/system/bin/frida-server",
    "/system/xbin/frida-server",
  )
  private val FRIDA_MARKERS = listOf("frida", "gum-js", "linjector")

  private const val TRACER_PID = "TracerPid:"
  private const val NOT_TRACED = 0

  private val EMULATOR_HARDWARE = setOf("goldfish", "ranchu", "vbox86")
  private val EMULATOR_PRODUCT_MARKERS = listOf("sdk_gphone", "google_sdk", "sdk_google", "sdk_x86", "vbox86p", "emulator", "simulator")
  private val EMULATOR_MODEL_MARKERS = listOf("google_sdk", "emulator", "android sdk built for")
  private const val GENYMOTION = "genymotion"
  private const val GENERIC_FINGERPRINT = "generic"
  private val QEMU_PROPERTIES = listOf("ro.kernel.qemu", "ro.boot.qemu")
  private const val QEMU = "1"
  private val EMULATOR_FILES = listOf(
    "/dev/qemu_pipe",
    "/dev/socket/qemud",
    "/dev/goldfish_pipe",
    "/sys/qemu_trace",
    "/system/bin/qemu-props",
  )

  private const val SIGNER_SEPARATOR = ','
  private const val DIGEST_BYTE_SEPARATOR = ":"
  private const val NOTHING = ""

  const val MOUNTS = "/proc/self/mounts"
  const val MAPS = "/proc/self/maps"
  const val STATUS = "/proc/self/status"

  private enum class Platform { HARDWARE, EMULATOR, UNKNOWN }

  private class Mount(val source: String, val point: String, val type: String, val options: List<String>)

  fun detect(evidence: IntegrityEvidence, policy: IntegrityPolicy): List<IntegritySignal> {
    val properties = failOpen(emptyMap()) { evidence.systemProperties() }
    val maps = failOpen(NOTHING) { memoryMapsOf(evidence) }
    val mounts = failOpen(emptyList()) { mountsOf(evidence) }
    val platform = failOpen(Platform.UNKNOWN) { platformOf(evidence, properties) }
    return buildList {
      if (holds { isRooted(evidence, properties, mounts, platform) }) add(IntegritySignal.ROOT)
      if (holds { hasMagisk(evidence, mounts, maps) }) add(IntegritySignal.MAGISK)
      if (holds { hasFrida(evidence, maps) }) add(IntegritySignal.FRIDA)
      // CAP-008-S06
      if (!policy.isDevelopmentBuild && holds { isDebugged(evidence) }) add(IntegritySignal.DEBUGGER)
      if (!policy.isDevelopmentBuild && platform == Platform.EMULATOR) add(IntegritySignal.EMULATOR)
      if (holds { isTampered(evidence, policy) }) add(IntegritySignal.APP_INTEGRITY)
    }
  }

  fun signerDigestsOf(configured: String): Set<String> =
    configured.split(SIGNER_SEPARATOR)
      .map { it.replace(DIGEST_BYTE_SEPARATOR, NOTHING).trim().lowercase() }
      .filter { it.isNotEmpty() }
      .toSet()

  private fun isRooted(
    evidence: IntegrityEvidence,
    properties: Map<String, String>,
    mounts: List<Mount>,
    platform: Platform,
  ): Boolean =
    SU_PATHS.any(evidence::exists) ||
      evidence.pathDirectories.any { evidence.exists(File(it, SU).path) } ||
      ROOT_MANAGERS.any(evidence::isInstalled) ||
      (platform == Platform.HARDWARE && hasOpenPlatform(properties, mounts))

  private fun hasOpenPlatform(properties: Map<String, String>, mounts: List<Mount>): Boolean =
    properties[VERIFIED_BOOT_STATE] == UNLOCKED_BOOT_STATE ||
      properties[FLASH_LOCKED] == UNLOCKED_FLASH ||
      properties[VBMETA_DEVICE_STATE] == UNLOCKED_VBMETA ||
      KNOX_WARRANTY_PROPERTIES.any { properties[it] == TRIPPED } ||
      properties[SECURE] == INSECURE_BUILD ||
      properties[DEBUGGABLE] == DEBUGGABLE_BUILD ||
      properties[SELINUX] == PERMISSIVE_SELINUX ||
      mounts.any(::isWritableSystem)

  private fun isWritableSystem(mount: Mount): Boolean =
    mount.point in SYSTEM_MOUNT_POINTS && mount.type in SYSTEM_FILESYSTEMS && READ_WRITE in mount.options

  private fun hasMagisk(evidence: IntegrityEvidence, mounts: List<Mount>, maps: String): Boolean =
    MAGISK_PATHS.any(evidence::exists) ||
      MAGISK_MANAGERS.any(evidence::isInstalled) ||
      mounts.any { it.source.lowercase() in MAGISK_MOUNT_SOURCES } ||
      MAGISK_LIBRARY_MARKERS.any(maps::contains)

  private fun hasFrida(evidence: IntegrityEvidence, maps: String): Boolean =
    FRIDA_PATHS.any(evidence::exists) ||
      FRIDA_MARKERS.any(maps::contains) ||
      evidence.threadNames().any { mentionsAny(it, FRIDA_MARKERS) } ||
      evidence.descriptorTargets().any { mentionsAny(withoutOwnCode(it, evidence.ownCodeDirectory), FRIDA_MARKERS) }

  private fun isDebugged(evidence: IntegrityEvidence): Boolean =
    evidence.isDebuggerAttached() || tracerPid(evidence.read(STATUS).orEmpty()) != NOT_TRACED

  private fun platformOf(evidence: IntegrityEvidence, properties: Map<String, String>): Platform {
    if (isEmulator(evidence.build, properties) || EMULATOR_FILES.any(evidence::exists)) {
      return Platform.EMULATOR
    }
    return Platform.HARDWARE
  }

  private fun isEmulator(build: BuildFacts, properties: Map<String, String>): Boolean =
    build.hardware.lowercase() in EMULATOR_HARDWARE ||
      mentionsAny(build.product, EMULATOR_PRODUCT_MARKERS) ||
      mentionsAny(build.model, EMULATOR_MODEL_MARKERS) ||
      build.manufacturer.lowercase().contains(GENYMOTION) ||
      build.fingerprint.lowercase().startsWith(GENERIC_FINGERPRINT) ||
      QEMU_PROPERTIES.any { properties[it] == QEMU }

  private fun isTampered(evidence: IntegrityEvidence, policy: IntegrityPolicy): Boolean {
    if (!policy.isDevelopmentBuild && evidence.isDebuggable()) {
      return true
    }
    if (policy.expectedSignerDigests.isEmpty()) {
      return false
    }
    val actual = evidence.signerDigests() ?: return false
    return actual.none { it in policy.expectedSignerDigests }
  }

  private fun tracerPid(status: String): Int =
    status.lineSequence()
      .firstOrNull { it.startsWith(TRACER_PID) }
      ?.removePrefix(TRACER_PID)
      ?.trim()
      ?.toIntOrNull()
      ?: NOT_TRACED

  private fun memoryMapsOf(evidence: IntegrityEvidence): String =
    withoutOwnCode(evidence.read(MAPS).orEmpty(), evidence.ownCodeDirectory).lowercase()

  private fun withoutOwnCode(text: String, ownCodeDirectory: String): String {
    if (ownCodeDirectory.isEmpty()) {
      return text
    }
    return text.replace(ownCodeDirectory, NOTHING)
  }

  private fun mountsOf(evidence: IntegrityEvidence): List<Mount> =
    evidence.read(MOUNTS).orEmpty().lineSequence().mapNotNull(::mountOf).toList()

  private fun mountOf(line: String): Mount? {
    val fields = line.split(MOUNT_FIELD_SEPARATOR)
    if (fields.size < MOUNT_FIELDS) {
      return null
    }
    val (source, point, type, options) = fields
    return Mount(source, point, type, options.split(MOUNT_OPTION_SEPARATOR))
  }

  private fun mentionsAny(text: String, markers: List<String>): Boolean {
    val lower = text.lowercase()
    return markers.any(lower::contains)
  }

  private fun holds(probe: () -> Boolean): Boolean = failOpen(false, probe)

  // CAP-008-R10, CAP-008-S04
  private fun <T> failOpen(fallback: T, probe: () -> T): T =
    try {
      probe()
    } catch (failed: RuntimeException) {
      fallback
    }
}
