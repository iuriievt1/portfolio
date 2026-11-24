package cz.veevoy.ansora.core.mobile

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Test

// CAP-008-R02, CAP-008-R10
class IntegrityDetectionTest {
  private class FakeEvidence(
    override val build: BuildFacts = SAMSUNG_A57,
    override val pathDirectories: List<String> = listOf("/system/bin", "/system/xbin"),
    override val ownCodeDirectory: String = OWN_CODE_DIRECTORY,
    val files: Set<String> = emptySet(),
    val properties: Map<String, String> = STOCK_PROPERTIES,
    val texts: Map<String, String> = emptyMap(),
    val threads: List<String> = listOf("main", "mqt_js"),
    val descriptors: List<String> = listOf("/dev/null"),
    val packages: Set<String> = emptySet(),
    val debuggerAttached: Boolean = false,
    val debuggable: Boolean = false,
    val signers: Set<String>? = setOf(RELEASE_SIGNER),
  ) : IntegrityEvidence {
    override fun exists(path: String) = path in files

    override fun systemProperties() = properties

    override fun read(path: String) = texts[path]

    override fun threadNames() = threads

    override fun descriptorTargets() = descriptors

    override fun isInstalled(packageName: String) = packageName in packages

    override fun isDebuggerAttached() = debuggerAttached

    override fun isDebuggable() = debuggable

    override fun signerDigests() = signers
  }

  private fun detected(evidence: IntegrityEvidence, policy: IntegrityPolicy = RELEASE) =
    IntegrityDetection.detect(evidence, policy)

  @Test
  fun `CAP-008-S04 finds nothing on a stock Samsung phone`() {
    val evidence = FakeEvidence(
      texts = mapOf(
        IntegrityDetection.MOUNTS to STOCK_MOUNTS,
        IntegrityDetection.MAPS to "7000-8000 r-xp 00000000 fd:00 1 $OWN_CODE_DIRECTORY/lib/arm64/libreactnative.so",
        IntegrityDetection.STATUS to "Name:\tcare.ansora.vulna\nTracerPid:\t0",
      ),
      descriptors = listOf("/dev/null", "$OWN_CODE_DIRECTORY/base.apk"),
    )

    assertEquals(emptyList<IntegritySignal>(), detected(evidence))
  }

  @Test
  fun `CAP-008-S04 does not read a marker in the random name of its own install directory`() {
    val ownCodeDirectory = "/data/app/~~XfridaZ9q==/care.ansora.vulna-magiskGumJsQ=="
    val evidence = FakeEvidence(
      ownCodeDirectory = ownCodeDirectory,
      texts = mapOf(
        IntegrityDetection.MAPS to listOf(
          "7000-8000 r--p 00000000 fd:00 1 $ownCodeDirectory/base.apk",
          "8000-9000 r-xp 00000000 fd:00 2 $ownCodeDirectory/lib/arm64/libreactnative.so",
        ).joinToString("\n"),
      ),
      descriptors = listOf("$ownCodeDirectory/base.apk"),
    )

    assertEquals(emptyList<IntegritySignal>(), detected(evidence))
  }

  @Test
  fun `CAP-008-R02 still reports Frida injected into its own install directory`() {
    val maps = mapOf(IntegrityDetection.MAPS to "7000-8000 r-xp 00000000 fd:00 1 $OWN_CODE_DIRECTORY/lib/arm64/libfrida-gadget.so")

    assertEquals(listOf(IntegritySignal.FRIDA), detected(FakeEvidence(texts = maps)))
  }

  @Test
  fun `CAP-008-R02 reports root for a su binary`() {
    assertEquals(listOf(IntegritySignal.ROOT), detected(FakeEvidence(files = setOf("/system/xbin/su"))))
  }

  @Test
  fun `CAP-008-R02 reports root for a su binary on the search path`() {
    val evidence = FakeEvidence(pathDirectories = listOf("/odm/bin"), files = setOf("/odm/bin/su"))

    assertEquals(listOf(IntegritySignal.ROOT), detected(evidence))
  }

  @Test
  fun `CAP-008-R02 reports root for an installed root manager`() {
    assertEquals(listOf(IntegritySignal.ROOT), detected(FakeEvidence(packages = setOf("eu.chainfire.supersu"))))
  }

  @Test
  fun `CAP-008-R02 reports root for each sign of an open platform alone`() {
    val openPlatform = listOf(
      "ro.boot.verifiedbootstate" to "orange",
      "ro.boot.flash.locked" to "0",
      "ro.boot.vbmeta.device_state" to "unlocked",
      "ro.boot.warranty_bit" to "1",
      "ro.warranty_bit" to "1",
      "ro.secure" to "0",
      "ro.debuggable" to "1",
      "ro.boot.selinux" to "permissive",
    )

    for (property in openPlatform) {
      val evidence = FakeEvidence(properties = STOCK_PROPERTIES + property)

      assertEquals(property.toString(), listOf(IntegritySignal.ROOT), detected(evidence))
    }
  }

  @Test
  fun `CAP-008-R02 reports root for a system partition mounted for writing`() {
    val mounts = mapOf(IntegrityDetection.MOUNTS to "/dev/block/dm-1 /system ext4 rw,seclabel 0 0")

    assertEquals(listOf(IntegritySignal.ROOT), detected(FakeEvidence(texts = mounts)))
  }

  @Test
  fun `CAP-008-R02 reports root for a system-as-root partition mounted for writing`() {
    val ext4 = mapOf(IntegrityDetection.MOUNTS to "/dev/block/dm-0 / ext4 rw,seclabel 0 0")
    val f2fs = mapOf(IntegrityDetection.MOUNTS to "/dev/block/dm-0 / f2fs rw,seclabel 0 0")

    assertEquals(listOf(IntegritySignal.ROOT), detected(FakeEvidence(texts = ext4)))
    assertEquals(listOf(IntegritySignal.ROOT), detected(FakeEvidence(texts = f2fs)))
  }

  @Test
  fun `CAP-008-S04 does not blame a writable root file system held in memory`() {
    val writableInMemory = listOf(
      "rootfs / rootfs rw,seclabel 0 0",
      "tmpfs / tmpfs rw,seclabel 0 0",
      "/dev/block/dm-0 / erofs rw,seclabel 0 0",
    )

    for (mount in writableInMemory) {
      val evidence = FakeEvidence(texts = mapOf(IntegrityDetection.MOUNTS to mount))

      assertEquals(mount, emptyList<IntegritySignal>(), detected(evidence))
    }
  }

  @Test
  fun `CAP-008-S01 reports Magisk for its files, its app, its mounts and its injected code`() {
    val mounts = mapOf(IntegrityDetection.MOUNTS to "magisk /system/bin tmpfs ro,seclabel 0 0")
    val maps = mapOf(IntegrityDetection.MAPS to "7000-8000 r-xp 00000000 00:00 1 /system/lib64/libzygisk.so")

    assertEquals(listOf(IntegritySignal.MAGISK), detected(FakeEvidence(files = setOf("/data/adb/magisk"))))
    assertEquals(listOf(IntegritySignal.MAGISK), detected(FakeEvidence(packages = setOf("com.topjohnwu.magisk"))))
    assertEquals(listOf(IntegritySignal.MAGISK), detected(FakeEvidence(texts = mounts)))
    assertEquals(listOf(IntegritySignal.MAGISK), detected(FakeEvidence(texts = maps)))
  }

  @Test
  fun `CAP-008-R02 reports Magisk for KernelSU and APatch`() {
    assertEquals(listOf(IntegritySignal.MAGISK), detected(FakeEvidence(packages = setOf("me.weishu.kernelsu"))))
    assertEquals(listOf(IntegritySignal.MAGISK), detected(FakeEvidence(files = setOf("/data/adb/ap"))))
  }

  @Test
  fun `CAP-008-R02 reports Frida in the memory, the threads and the descriptors of the app`() {
    val maps = mapOf(IntegrityDetection.MAPS to "7000-8000 r-xp 00000000 00:00 1 /data/local/tmp/frida-agent-64.so")

    assertEquals(listOf(IntegritySignal.FRIDA), detected(FakeEvidence(texts = maps)))
    assertEquals(listOf(IntegritySignal.FRIDA), detected(FakeEvidence(threads = listOf("main", "gum-js-loop"))))
    assertEquals(listOf(IntegritySignal.FRIDA), detected(FakeEvidence(threads = listOf("main", "pool-frida"))))
    assertEquals(listOf(IntegritySignal.FRIDA), detected(FakeEvidence(descriptors = listOf("/data/local/tmp/linjector-3"))))
    assertEquals(listOf(IntegritySignal.FRIDA), detected(FakeEvidence(files = setOf("/data/local/tmp/frida-server"))))
  }

  @Test
  fun `CAP-008-S02 reports an attached debugger and a native tracer`() {
    val traced = mapOf(IntegrityDetection.STATUS to "Name:\tcare.ansora.vulna\nTracerPid:\t4321")

    assertEquals(listOf(IntegritySignal.DEBUGGER), detected(FakeEvidence(debuggerAttached = true)))
    assertEquals(listOf(IntegritySignal.DEBUGGER), detected(FakeEvidence(texts = traced)))
  }

  @Test
  fun `CAP-008-S06 reports the emulator for each of its marks alone`() {
    val emulators = listOf(
      FakeEvidence(build = SAMSUNG_A57.copy(hardware = "ranchu")),
      FakeEvidence(build = SAMSUNG_A57.copy(product = "sdk_gphone64_arm64")),
      FakeEvidence(build = SAMSUNG_A57.copy(model = "Android SDK built for x86")),
      FakeEvidence(build = SAMSUNG_A57.copy(manufacturer = "Genymotion")),
      FakeEvidence(build = SAMSUNG_A57.copy(fingerprint = "generic/sdk/generic:7.0/NYC/1:user/release-keys")),
      FakeEvidence(properties = STOCK_PROPERTIES + ("ro.kernel.qemu" to "1")),
      FakeEvidence(properties = STOCK_PROPERTIES + ("ro.boot.qemu" to "1")),
      FakeEvidence(files = setOf("/dev/qemu_pipe")),
    )

    for ((index, emulator) in emulators.withIndex()) {
      assertEquals("emulator mark $index", listOf(IntegritySignal.EMULATOR), detected(emulator))
    }
  }

  @Test
  fun `CAP-008-S06 reports the emulator without blaming its open platform on root`() {
    val openPlatform = STOCK_PROPERTIES + mapOf(
      "ro.boot.qemu" to "1",
      "ro.boot.verifiedbootstate" to "orange",
      "ro.debuggable" to "1",
      "ro.boot.selinux" to "permissive",
    )
    val emulator = FakeEvidence(
      build = PIXEL_EMULATOR,
      properties = openPlatform,
      texts = mapOf(IntegrityDetection.MOUNTS to "/dev/block/vda / ext4 rw,seclabel 0 0"),
    )

    assertEquals(listOf(IntegritySignal.EMULATOR), detected(emulator))
  }

  @Test
  fun `CAP-008-S06 lets a development build run under a debugger and in the emulator`() {
    val developer = FakeEvidence(build = PIXEL_EMULATOR, debuggerAttached = true, debuggable = true, signers = setOf("debug"))

    assertEquals(emptyList<IntegritySignal>(), detected(developer, DEVELOPMENT))
  }

  @Test
  fun `CAP-008-S06 still reports root, Magisk and Frida in a development build`() {
    val tampered = FakeEvidence(files = setOf("/system/xbin/su", "/data/adb/magisk", "/data/local/tmp/frida-server"))
    val unlocked = FakeEvidence(properties = STOCK_PROPERTIES + ("ro.boot.verifiedbootstate" to "orange"))

    assertEquals(listOf(IntegritySignal.ROOT, IntegritySignal.MAGISK, IntegritySignal.FRIDA), detected(tampered, DEVELOPMENT))
    assertEquals(listOf(IntegritySignal.ROOT), detected(unlocked, DEVELOPMENT))
  }

  @Test
  fun `CAP-008-R02 reports a release signed by another key`() {
    assertEquals(listOf(IntegritySignal.APP_INTEGRITY), detected(FakeEvidence(signers = setOf("0123"))))
  }

  @Test
  fun `CAP-008-R02 reports a release that can be debugged`() {
    assertEquals(listOf(IntegritySignal.APP_INTEGRITY), detected(FakeEvidence(debuggable = true)))
  }

  @Test
  fun `CAP-008-S04 does not blame the app when its signature cannot be read or no key is configured`() {
    val unconfigured = IntegrityPolicy(isDevelopmentBuild = false, expectedSignerDigests = emptySet())

    assertEquals(emptyList<IntegritySignal>(), detected(FakeEvidence(signers = null)))
    assertEquals(emptyList<IntegritySignal>(), detected(FakeEvidence(signers = setOf("0123")), unconfigured))
  }

  @Test
  fun `CAP-008-R10 reports every signal it finds`() {
    val evidence = FakeEvidence(files = setOf("/system/bin/su", "/data/adb/modules"), debuggerAttached = true)

    assertEquals(listOf(IntegritySignal.ROOT, IntegritySignal.MAGISK, IntegritySignal.DEBUGGER), detected(evidence))
  }

  @Test
  fun `CAP-008-R10 keeps the other checks when one of them fails`() {
    val threadsFail = object : IntegrityEvidence by FakeEvidence(files = setOf("/system/xbin/su")) {
      override fun threadNames(): List<String> = throw IllegalStateException("threads cannot be listed")
    }
    val propertiesFail = object : IntegrityEvidence by FakeEvidence(debuggerAttached = true) {
      override fun systemProperties(): Map<String, String> = throw IllegalStateException("getprop failed")
    }
    val packagesFail = object : IntegrityEvidence by FakeEvidence(threads = listOf("gum-js-loop")) {
      override fun isInstalled(packageName: String): Boolean = throw SecurityException("package visibility")
    }

    assertEquals(listOf(IntegritySignal.ROOT), detected(threadsFail))
    assertEquals(listOf(IntegritySignal.DEBUGGER), detected(propertiesFail))
    assertEquals(listOf(IntegritySignal.FRIDA), detected(packagesFail))
  }

  @Test
  fun `CAP-008-S06 skips the open platform when the emulator check failed`() {
    val unknown = object : IntegrityEvidence by FakeEvidence(properties = STOCK_PROPERTIES + ("ro.boot.verifiedbootstate" to "orange")) {
      override fun exists(path: String): Boolean {
        if (path == "/dev/qemu_pipe") {
          throw SecurityException("path cannot be checked")
        }
        return false
      }
    }

    assertEquals(emptyList<IntegritySignal>(), detected(unknown))
  }

  @Test
  fun `reads the configured signing keys in any notation`() {
    assertEquals(setOf("a80c", "beef"), IntegrityDetection.signerDigestsOf(" A8:0C , beef,"))
    assertEquals(emptySet<String>(), IntegrityDetection.signerDigestsOf(""))
  }

  @Test
  fun `CAP-008-R02 lets the app see every manager it looks for`() {
    val manifest = File("src/main/AndroidManifest.xml").readText()
    val declared = Regex("""<package android:name="([^"]+)" />""").findAll(manifest).map { it.groupValues[1] }.toSet()

    assertEquals((IntegrityDetection.ROOT_MANAGERS + IntegrityDetection.MAGISK_MANAGERS).toSet(), declared)
  }

  private companion object {
    const val RELEASE_SIGNER = "a80c265beb29666efaf29432a7ee4a734b1d96a2ed24f794869fa8d889edbbc6"
    const val OWN_CODE_DIRECTORY = "/data/app/~~4fXbq1Ke9wT0==/care.ansora.vulna-Tz0Lq7cR2mY1=="
    const val STOCK_MOUNTS = "/dev/block/dm-0 / erofs ro,seclabel 0 0\n" +
      "/dev/block/dm-5 /vendor erofs ro,seclabel 0 0\n" +
      "tmpfs /dev tmpfs rw,seclabel 0 0\n" +
      "/dev/block/by-name/userdata /data f2fs rw,seclabel 0 0"
    val RELEASE = IntegrityPolicy(isDevelopmentBuild = false, expectedSignerDigests = setOf(RELEASE_SIGNER))
    val DEVELOPMENT = IntegrityPolicy(isDevelopmentBuild = true, expectedSignerDigests = emptySet())
    val SAMSUNG_A57 = BuildFacts(
      fingerprint = "samsung/a57xeea/a57x:16/BP2A.250605.031.A3/A576BXXU1AYJ1:user/release-keys",
      hardware = "s5e8855",
      product = "a57xeea",
      model = "SM-A576B",
      manufacturer = "samsung",
    )
    val PIXEL_EMULATOR = BuildFacts(
      fingerprint = "google/sdk_gphone64_arm64/emu64a:16/BE2A.250530.026.D1/13818094:user/release-keys",
      hardware = "ranchu",
      product = "sdk_gphone64_arm64",
      model = "sdk_gphone64_arm64",
      manufacturer = "Google",
    )
    val STOCK_PROPERTIES = mapOf(
      "ro.boot.verifiedbootstate" to "green",
      "ro.boot.flash.locked" to "1",
      "ro.boot.vbmeta.device_state" to "locked",
      "ro.boot.warranty_bit" to "0",
      "ro.secure" to "1",
      "ro.debuggable" to "0",
      "ro.boot.selinux" to "enforcing",
    )
  }
}
