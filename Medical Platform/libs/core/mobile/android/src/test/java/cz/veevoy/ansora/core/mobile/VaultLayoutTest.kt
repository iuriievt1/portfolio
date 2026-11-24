package cz.veevoy.ansora.core.mobile

import java.io.File
import java.io.IOException
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

// CAP-009-S05, ADR-038, Q-076
class VaultLayoutTest {
  @Test
  fun `CAP-009-S05 sets the storage aside and keeps every file`() {
    val root = Files.createTempDirectory("vault").toFile()
    val queue = File(root, "queue").apply { mkdirs() }
    File(queue, "photo").writeText("sealed")

    val aside = VaultLayout.setAside(queue, 1_760_870_000_000L)

    assertEquals("queue.set-aside.1760870000000", aside?.name)
    assertFalse(queue.exists())
    assertEquals("sealed", File(aside, "photo").readText())
    root.deleteRecursively()
  }

  @Test
  fun `CAP-007-R04 erases every storage of the vault and keeps only the retained entries`() {
    val root = Files.createTempDirectory("vault").toFile()
    File(root, "queue").apply { mkdirs() }.resolve("photo").writeText("sealed")
    File(root, "uploads").mkdirs()
    File(root, "pins.json").writeText("{}")

    VaultLayout.erase(root, setOf("pins.json"))

    assertEquals(listOf("pins.json"), root.list()?.toList())
    root.deleteRecursively()
  }

  @Test
  fun `CAP-007-R04 refuses to erase a vault it cannot list`() {
    val missing = File(Files.createTempDirectory("vault").toFile(), "missing")

    assertThrows(IOException::class.java) { VaultLayout.erase(missing, emptySet()) }
  }

  @Test
  fun `CAP-009-S05 has nothing to set aside without a storage`() {
    val root = Files.createTempDirectory("vault").toFile()

    assertNull(VaultLayout.setAside(File(root, "queue"), 1_760_870_000_000L))
    root.deleteRecursively()
  }
}
