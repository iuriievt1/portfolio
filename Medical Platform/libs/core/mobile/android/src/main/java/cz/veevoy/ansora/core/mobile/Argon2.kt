package cz.veevoy.ansora.core.mobile

internal object Argon2 {
  class Parameters(val memoryKiB: Int, val passes: Int, val parallelism: Int, val tagLength: Int)

  class InvalidParametersException : IllegalArgumentException("Argon2 parameters are out of range")

  private const val VERSION = 0x13
  private const val ARGON2ID_TYPE = 2
  private const val BLOCK_WORDS = 128
  private const val BLOCK_BYTES = BLOCK_WORDS * 8
  private const val SYNC_POINTS = 4
  private const val ADDRESSES_PER_BLOCK = 128
  private const val PREHASH_BYTES = 64
  private const val LOW_WORD = 0xffff_ffffL

  // RFC 9106 3.5
  private const val MATRIX_SIDE = 8
  private const val REGISTER_WORDS = 2
  private const val ROW_WORDS = MATRIX_SIDE * REGISTER_WORDS

  private class Context(val blockCount: Int, val lanes: Int, val laneLength: Int, val segmentLength: Int, val passes: Int)

  fun hash(
    password: ByteArray,
    salt: ByteArray,
    secret: ByteArray = ByteArray(0),
    associatedData: ByteArray = ByteArray(0),
    parameters: Parameters,
  ): ByteArray {
    val lanes = parameters.parallelism
    if (lanes < 1 || parameters.passes < 1 || parameters.tagLength < 4 || parameters.memoryKiB < 8 * lanes) {
      throw InvalidParametersException()
    }
    val blockCount = parameters.memoryKiB / (4 * lanes) * 4 * lanes
    val laneLength = blockCount / lanes
    val context = Context(blockCount, lanes, laneLength, laneLength / SYNC_POINTS, parameters.passes)

    val h0 = initialHash(password, salt, secret, associatedData, parameters)
    val memory = LongArray(blockCount * BLOCK_WORDS)
    val seed = ByteArray(PREHASH_BYTES + 8)
    h0.copyInto(seed)
    for (lane in 0 until lanes) {
      for (column in 0 until 2) {
        littleEndian(column).copyInto(seed, PREHASH_BYTES)
        littleEndian(lane).copyInto(seed, PREHASH_BYTES + 4)
        storeBlock(variableLengthHash(seed, BLOCK_BYTES), memory, lane * laneLength + column)
      }
    }
    h0.fill(0)

    for (pass in 0 until context.passes) {
      for (slice in 0 until SYNC_POINTS) {
        for (lane in 0 until lanes) {
          fillSegment(memory, context, pass, lane, slice)
        }
      }
    }

    val final = LongArray(BLOCK_WORDS)
    for (lane in 0 until lanes) {
      val offset = (lane * laneLength + laneLength - 1) * BLOCK_WORDS
      for (word in 0 until BLOCK_WORDS) {
        final[word] = final[word] xor memory[offset + word]
      }
    }
    memory.fill(0)
    return variableLengthHash(bytesOf(final), parameters.tagLength)
  }

  private fun initialHash(
    password: ByteArray, salt: ByteArray, secret: ByteArray, associatedData: ByteArray, parameters: Parameters,
  ): ByteArray {
    val input = java.io.ByteArrayOutputStream()
    input.write(littleEndian(parameters.parallelism))
    input.write(littleEndian(parameters.tagLength))
    input.write(littleEndian(parameters.memoryKiB))
    input.write(littleEndian(parameters.passes))
    input.write(littleEndian(VERSION))
    input.write(littleEndian(ARGON2ID_TYPE))
    for (part in listOf(password, salt, secret, associatedData)) {
      input.write(littleEndian(part.size))
      input.write(part)
    }
    return Blake2b.hash(input.toByteArray(), PREHASH_BYTES)
  }

  fun variableLengthHash(input: ByteArray, outputLength: Int): ByteArray {
    val prefixed = littleEndian(outputLength) + input
    if (outputLength <= Blake2b.MAXIMUM_OUTPUT) {
      return Blake2b.hash(prefixed, outputLength)
    }
    val half = Blake2b.MAXIMUM_OUTPUT / 2
    val rounds = (outputLength + half - 1) / half - 2
    val output = java.io.ByteArrayOutputStream()
    var block = Blake2b.hash(prefixed, Blake2b.MAXIMUM_OUTPUT)
    output.write(block, 0, half)
    repeat(rounds - 1) {
      block = Blake2b.hash(block, Blake2b.MAXIMUM_OUTPUT)
      output.write(block, 0, half)
    }
    output.write(Blake2b.hash(block, outputLength - rounds * half))
    return output.toByteArray()
  }

  private fun fillSegment(memory: LongArray, context: Context, pass: Int, lane: Int, slice: Int) {
    val dataIndependent = pass == 0 && slice < SYNC_POINTS / 2
    val addressBlock = LongArray(BLOCK_WORDS)
    val inputBlock = LongArray(BLOCK_WORDS)
    val scratch = Scratch()
    if (dataIndependent) {
      inputBlock[0] = pass.toLong()
      inputBlock[1] = lane.toLong()
      inputBlock[2] = slice.toLong()
      inputBlock[3] = context.blockCount.toLong()
      inputBlock[4] = context.passes.toLong()
      inputBlock[5] = ARGON2ID_TYPE.toLong()
    }
    var index = 0
    if (pass == 0 && slice == 0) {
      index = 2
      if (dataIndependent) {
        nextAddresses(addressBlock, inputBlock, scratch)
      }
    }
    var current = lane * context.laneLength + slice * context.segmentLength + index
    var previous = if (current % context.laneLength == 0) current + context.laneLength - 1 else current - 1
    while (index < context.segmentLength) {
      val pseudoRandom: Long
      if (dataIndependent) {
        if (index % ADDRESSES_PER_BLOCK == 0) {
          nextAddresses(addressBlock, inputBlock, scratch)
        }
        pseudoRandom = addressBlock[index % ADDRESSES_PER_BLOCK]
      } else {
        pseudoRandom = memory[previous * BLOCK_WORDS]
      }
      val referenceLane = if (pass == 0 && slice == 0) lane else ((pseudoRandom ushr 32) % context.lanes).toInt()
      val referenceIndex = referenceIndex(context, pass, slice, index, pseudoRandom and LOW_WORD, referenceLane == lane)
      val reference = referenceLane * context.laneLength + referenceIndex
      compress(memory, previous * BLOCK_WORDS, memory, reference * BLOCK_WORDS, memory, current * BLOCK_WORDS, pass > 0, scratch)
      index += 1
      current += 1
      previous = current - 1
    }
  }

  private fun nextAddresses(addresses: LongArray, input: LongArray, scratch: Scratch) {
    input[6] += 1
    val zero = LongArray(BLOCK_WORDS)
    compress(zero, 0, input, 0, addresses, 0, false, scratch)
    compress(zero, 0, addresses, 0, addresses, 0, false, scratch)
  }

  private fun referenceIndex(context: Context, pass: Int, slice: Int, index: Int, pseudoRandom: Long, sameLane: Boolean): Int {
    val referenceArea = if (pass == 0) {
      when {
        slice == 0 -> index - 1
        sameLane -> slice * context.segmentLength + index - 1
        else -> slice * context.segmentLength + (if (index == 0) -1 else 0)
      }
    } else if (sameLane) {
      context.laneLength - context.segmentLength + index - 1
    } else {
      context.laneLength - context.segmentLength + (if (index == 0) -1 else 0)
    }
    var relative = pseudoRandom
    relative = (relative * relative) ushr 32
    relative = referenceArea - 1 - ((referenceArea * relative) ushr 32)
    val start = if (pass == 0) 0 else (slice + 1) * context.segmentLength % context.laneLength
    return ((start + relative) % context.laneLength).toInt()
  }

  private class Scratch {
    val r = LongArray(BLOCK_WORDS)
    val q = LongArray(BLOCK_WORDS)
  }

  private fun compress(
    previous: LongArray, previousOffset: Int,
    reference: LongArray, referenceOffset: Int,
    next: LongArray, nextOffset: Int,
    withXor: Boolean,
    scratch: Scratch,
  ) {
    val r = scratch.r
    val q = scratch.q
    for (word in 0 until BLOCK_WORDS) {
      r[word] = previous[previousOffset + word] xor reference[referenceOffset + word]
      q[word] = r[word]
    }
    for (row in 0 until MATRIX_SIDE) {
      permuteRow(q, row * ROW_WORDS)
    }
    for (column in 0 until MATRIX_SIDE) {
      permuteColumn(q, column * REGISTER_WORDS)
    }
    for (word in 0 until BLOCK_WORDS) {
      val value = q[word] xor r[word]
      next[nextOffset + word] = if (withXor) next[nextOffset + word] xor value else value
    }
  }

  private fun permuteRow(v: LongArray, o: Int) {
    mix(v, o, o + 4, o + 8, o + 12)
    mix(v, o + 1, o + 5, o + 9, o + 13)
    mix(v, o + 2, o + 6, o + 10, o + 14)
    mix(v, o + 3, o + 7, o + 11, o + 15)
    mix(v, o, o + 5, o + 10, o + 15)
    mix(v, o + 1, o + 6, o + 11, o + 12)
    mix(v, o + 2, o + 7, o + 8, o + 13)
    mix(v, o + 3, o + 4, o + 9, o + 14)
  }

  private fun permuteColumn(v: LongArray, o: Int) {
    mix(v, o, o + 32, o + 64, o + 96)
    mix(v, o + 1, o + 33, o + 65, o + 97)
    mix(v, o + 16, o + 48, o + 80, o + 112)
    mix(v, o + 17, o + 49, o + 81, o + 113)
    mix(v, o, o + 33, o + 80, o + 113)
    mix(v, o + 1, o + 48, o + 81, o + 96)
    mix(v, o + 16, o + 49, o + 64, o + 97)
    mix(v, o + 17, o + 32, o + 65, o + 112)
  }

  private fun mix(v: LongArray, a: Int, b: Int, c: Int, d: Int) {
    v[a] = v[a] + v[b] + 2 * (v[a] and LOW_WORD) * (v[b] and LOW_WORD)
    v[d] = java.lang.Long.rotateRight(v[d] xor v[a], 32)
    v[c] = v[c] + v[d] + 2 * (v[c] and LOW_WORD) * (v[d] and LOW_WORD)
    v[b] = java.lang.Long.rotateRight(v[b] xor v[c], 24)
    v[a] = v[a] + v[b] + 2 * (v[a] and LOW_WORD) * (v[b] and LOW_WORD)
    v[d] = java.lang.Long.rotateRight(v[d] xor v[a], 16)
    v[c] = v[c] + v[d] + 2 * (v[c] and LOW_WORD) * (v[d] and LOW_WORD)
    v[b] = java.lang.Long.rotateRight(v[b] xor v[c], 63)
  }

  private fun storeBlock(block: ByteArray, memory: LongArray, index: Int) {
    for (word in 0 until BLOCK_WORDS) {
      var value = 0L
      for (byte in 0 until 8) {
        value = value or ((block[word * 8 + byte].toLong() and 0xff) shl (8 * byte))
      }
      memory[index * BLOCK_WORDS + word] = value
    }
  }

  private fun bytesOf(block: LongArray): ByteArray {
    val out = ByteArray(block.size * 8)
    for ((word, value) in block.withIndex()) {
      for (byte in 0 until 8) {
        out[word * 8 + byte] = (value ushr (8 * byte)).toByte()
      }
    }
    return out
  }

  private fun littleEndian(value: Int): ByteArray =
    byteArrayOf(value.toByte(), (value ushr 8).toByte(), (value ushr 16).toByte(), (value ushr 24).toByte())
}

internal object Blake2b {
  const val MAXIMUM_OUTPUT = 64

  private val IV = longArrayOf(
    0x6a09e667f3bcc908L, -0x4498517a7b3558c5L, 0x3c6ef372fe94f82bL, -0x5ab00ac5a0e2c90fL,
    0x510e527fade682d1L, -0x64fa9773d4c193e1L, 0x1f83d9abfb41bd6bL, 0x5be0cd19137e2179L,
  )
  private val SIGMA = arrayOf(
    intArrayOf(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15),
    intArrayOf(14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3),
    intArrayOf(11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4),
    intArrayOf(7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8),
    intArrayOf(9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13),
    intArrayOf(2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9),
    intArrayOf(12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11),
    intArrayOf(13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10),
    intArrayOf(6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5),
    intArrayOf(10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0),
  )
  private const val BLOCK_BYTES = 128
  private const val ROUNDS = 12

  fun hash(input: ByteArray, outputLength: Int): ByteArray {
    require(outputLength in 1..MAXIMUM_OUTPUT)
    val h = IV.copyOf()
    h[0] = h[0] xor (0x01010000L xor outputLength.toLong())
    var offset = 0
    var counter = 0L
    while (input.size - offset > BLOCK_BYTES) {
      counter += BLOCK_BYTES
      compress(h, input, offset, counter, false)
      offset += BLOCK_BYTES
    }
    val remaining = input.size - offset
    counter += remaining
    val last = ByteArray(BLOCK_BYTES)
    input.copyInto(last, 0, offset, input.size)
    compress(h, last, 0, counter, true)
    val out = ByteArray(MAXIMUM_OUTPUT)
    for ((word, value) in h.withIndex()) {
      for (byte in 0 until 8) {
        out[word * 8 + byte] = (value ushr (8 * byte)).toByte()
      }
    }
    return out.copyOf(outputLength)
  }

  private fun compress(h: LongArray, block: ByteArray, offset: Int, counter: Long, last: Boolean) {
    val m = LongArray(16)
    for (word in 0 until 16) {
      for (byte in 0 until 8) {
        m[word] = m[word] or ((block[offset + word * 8 + byte].toLong() and 0xff) shl (8 * byte))
      }
    }
    val v = LongArray(16)
    h.copyInto(v)
    IV.copyInto(v, 8)
    v[12] = v[12] xor counter
    if (last) {
      v[14] = v[14].inv()
    }
    for (round in 0 until ROUNDS) {
      val s = SIGMA[round % 10]
      mix(v, 0, 4, 8, 12, m[s[0]], m[s[1]])
      mix(v, 1, 5, 9, 13, m[s[2]], m[s[3]])
      mix(v, 2, 6, 10, 14, m[s[4]], m[s[5]])
      mix(v, 3, 7, 11, 15, m[s[6]], m[s[7]])
      mix(v, 0, 5, 10, 15, m[s[8]], m[s[9]])
      mix(v, 1, 6, 11, 12, m[s[10]], m[s[11]])
      mix(v, 2, 7, 8, 13, m[s[12]], m[s[13]])
      mix(v, 3, 4, 9, 14, m[s[14]], m[s[15]])
    }
    for (index in 0 until 8) {
      h[index] = h[index] xor v[index] xor v[index + 8]
    }
  }

  private fun mix(v: LongArray, a: Int, b: Int, c: Int, d: Int, x: Long, y: Long) {
    v[a] = v[a] + v[b] + x
    v[d] = java.lang.Long.rotateRight(v[d] xor v[a], 32)
    v[c] = v[c] + v[d]
    v[b] = java.lang.Long.rotateRight(v[b] xor v[c], 24)
    v[a] = v[a] + v[b] + y
    v[d] = java.lang.Long.rotateRight(v[d] xor v[a], 16)
    v[c] = v[c] + v[d]
    v[b] = java.lang.Long.rotateRight(v[b] xor v[c], 63)
  }
}
