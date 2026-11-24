package cz.veevoy.ansora.core.mobile

import android.content.Context
import java.io.File
import java.io.IOException

private const val STAGING_SUFFIX = ".staging"
private const val SET_ASIDE_INFIX = ".set-aside."

// NAB-412
internal object VaultLayout {
  const val DIRECTORY_NAME = "vault"

  fun root(context: Context): File {
    val root = File(context.filesDir, DIRECTORY_NAME)
    if (!root.isDirectory && !root.mkdirs()) {
      throw IOException("Cannot create the vault")
    }
    return root
  }

  fun directory(context: Context, name: String): File {
    val directory = File(root(context), name)
    if (!directory.isDirectory && !directory.mkdirs()) {
      throw IOException("Cannot create the vault directory $name")
    }
    return directory
  }

  // CAP-007-R04, CAP-009-R14
  fun eraseAll(context: Context, retained: Set<String>) {
    erase(root(context), retained)
  }

  fun erase(directory: File, retained: Set<String>) {
    val entries = directory.listFiles() ?: throw IOException("Cannot list the vault")
    for (entry in entries.filter { it.name !in retained }) {
      if (!entry.deleteRecursively()) {
        throw IOException("Cannot erase the vault entry ${entry.name}")
      }
    }
  }

  // CAP-009-S05, ADR-038, Q-076
  fun setAside(directory: File, atMs: Long): File? {
    if (!directory.exists()) {
      return null
    }
    val aside = File(directory.parentFile, directory.name + SET_ASIDE_INFIX + atMs)
    if (!directory.renameTo(aside)) {
      throw IOException("Cannot set aside the vault directory ${directory.name}")
    }
    return aside
  }
}

internal fun writeAtomically(target: File, text: String) {
  val staging = File(target.path + STAGING_SUFFIX)
  staging.writeText(text)
  if (!staging.renameTo(target)) {
    staging.delete()
    throw IOException("Cannot write ${target.name}")
  }
}
