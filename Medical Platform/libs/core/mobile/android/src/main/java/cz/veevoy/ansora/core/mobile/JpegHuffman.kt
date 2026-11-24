package cz.veevoy.ansora.core.mobile

import java.io.ByteArrayOutputStream

internal class HuffmanCode(val symbol: Int, val code: Int, val length: Int)

// ITU-T T.81 B.2.4.2
internal class HuffmanTable(val counts: IntArray, val symbols: IntArray) {
  val serialized: ByteArray
    get() = ByteArray(counts.size + symbols.size) { index ->
      (if (index < counts.size) counts[index] else symbols[index - counts.size]).toByte()
    }

  // ITU-T T.81 C.2
  fun codes(): List<HuffmanCode> {
    val result = mutableListOf<HuffmanCode>()
    var code = 0
    var index = 0
    for (length in 1..MAXIMUM_CODE_LENGTH) {
      repeat(counts[length - 1]) {
        if (code >= (1 shl length)) {
          throw JpegMalformedException()
        }
        result.add(HuffmanCode(symbols[index], code, length))
        code += 1
        index += 1
      }
      code = code shl 1
    }
    return result
  }

  companion object {
    const val MAXIMUM_CODE_LENGTH = 16
    const val ALPHABET_SIZE = 256
    private const val RESERVED = ALPHABET_SIZE
    private const val LONGEST = 32

    fun parse(payload: ByteArray, start: Int): Pair<HuffmanTable, Int> {
      if (payload.size - start < MAXIMUM_CODE_LENGTH) {
        throw JpegMalformedException()
      }
      val counts = IntArray(MAXIMUM_CODE_LENGTH) { payload.unsigned(start + it) }
      val total = counts.sum()
      if (payload.size - start < MAXIMUM_CODE_LENGTH + total) {
        throw JpegMalformedException()
      }
      val symbols = IntArray(total) { payload.unsigned(start + MAXIMUM_CODE_LENGTH + it) }
      return HuffmanTable(counts, symbols) to MAXIMUM_CODE_LENGTH + total
    }

    // ITU-T T.81 K.2
    fun optimal(frequencies: IntArray): HuffmanTable {
      val frequency = frequencies.copyOf(RESERVED + 1).also { it[RESERVED] = 1 }
      val codeSize = IntArray(RESERVED + 1)
      val others = IntArray(RESERVED + 1) { -1 }
      while (true) {
        var first = -1
        var least = Int.MAX_VALUE
        for (symbol in 0..RESERVED) {
          if (frequency[symbol] != 0 && frequency[symbol] <= least) {
            least = frequency[symbol]
            first = symbol
          }
        }
        var second = -1
        least = Int.MAX_VALUE
        for (symbol in 0..RESERVED) {
          if (frequency[symbol] != 0 && frequency[symbol] <= least && symbol != first) {
            least = frequency[symbol]
            second = symbol
          }
        }
        if (second < 0) {
          break
        }
        frequency[first] += frequency[second]
        frequency[second] = 0
        codeSize[first] += 1
        while (others[first] >= 0) {
          first = others[first]
          codeSize[first] += 1
        }
        others[first] = second
        codeSize[second] += 1
        while (others[second] >= 0) {
          second = others[second]
          codeSize[second] += 1
        }
      }
      val bits = IntArray(LONGEST + 1)
      for (symbol in 0..RESERVED) {
        if (codeSize[symbol] > LONGEST) {
          throw JpegUnsupportedException()
        }
        if (codeSize[symbol] > 0) {
          bits[codeSize[symbol]] += 1
        }
      }
      var length = LONGEST
      while (length > MAXIMUM_CODE_LENGTH) {
        while (bits[length] > 0) {
          var shorter = length - 2
          while (bits[shorter] == 0) {
            shorter -= 1
          }
          bits[length] -= 2
          bits[length - 1] += 1
          bits[shorter + 1] += 2
          bits[shorter] -= 1
        }
        length -= 1
      }
      var last = MAXIMUM_CODE_LENGTH
      while (bits[last] == 0) {
        last -= 1
      }
      bits[last] -= 1
      val symbols = mutableListOf<Int>()
      for (size in 1..LONGEST) {
        for (symbol in 0 until RESERVED) {
          if (codeSize[symbol] == size) {
            symbols.add(symbol)
          }
        }
      }
      return HuffmanTable(bits.copyOfRange(1, MAXIMUM_CODE_LENGTH + 1), symbols.toIntArray())
    }
  }
}

internal class HuffmanDecoder(table: HuffmanTable) {
  private val lookup = IntArray(1 shl LOOKAHEAD_BITS)
  private val maximumCode = IntArray(HuffmanTable.MAXIMUM_CODE_LENGTH + 1) { -1 }
  private val valueOffset = IntArray(HuffmanTable.MAXIMUM_CODE_LENGTH + 1)
  private val symbols = table.symbols

  init {
    for ((index, entry) in table.codes().withIndex()) {
      if (maximumCode[entry.length] < 0) {
        valueOffset[entry.length] = index - entry.code
      }
      maximumCode[entry.length] = entry.code
      if (entry.length > LOOKAHEAD_BITS) {
        continue
      }
      val spread = LOOKAHEAD_BITS - entry.length
      val first = entry.code shl spread
      for (slot in first until first + (1 shl spread)) {
        lookup[slot] = entry.length shl 8 or entry.symbol
      }
    }
  }

  // ITU-T T.81 F.2.2.3
  fun decode(reader: EntropyReader): Int {
    val entry = lookup[reader.peek(LOOKAHEAD_BITS)]
    if (entry != 0) {
      reader.skip(entry shr 8)
      return entry and 0xFF
    }
    var code = reader.bits(LOOKAHEAD_BITS)
    for (length in LOOKAHEAD_BITS + 1..HuffmanTable.MAXIMUM_CODE_LENGTH) {
      code = code shl 1 or reader.bits(1)
      if (code <= maximumCode[length]) {
        return symbols[valueOffset[length] + code]
      }
    }
    throw JpegMalformedException()
  }

  private companion object {
    const val LOOKAHEAD_BITS = 9
  }
}

internal class HuffmanEncoder(table: HuffmanTable) {
  private val codes = IntArray(HuffmanTable.ALPHABET_SIZE)
  private val lengths = IntArray(HuffmanTable.ALPHABET_SIZE)

  init {
    for (entry in table.codes()) {
      codes[entry.symbol] = entry.code
      lengths[entry.symbol] = entry.length
    }
  }

  fun encode(symbol: Int, writer: EntropyWriter) {
    writer.write(codes[symbol], lengths[symbol])
  }
}

// ITU-T T.81 F.2.2.5, B.1.1.5
internal class EntropyReader(private val data: ByteArray) {
  private var position = 0
  private var buffer = 0L
  private var count = 0
  private var reachedMarker = false

  fun peek(length: Int): Int {
    if (count < length) {
      fill()
    }
    return ((buffer ushr (BUFFER_BITS - length)) and ((1L shl length) - 1)).toInt()
  }

  fun skip(length: Int) {
    buffer = (buffer shl length) and 0xFFFFFFFFL
    count -= length
  }

  fun bits(length: Int): Int {
    if (length == 0) {
      return 0
    }
    val value = peek(length)
    skip(length)
    return value
  }

  // ITU-T T.81 F.2.2.5
  fun restart() {
    buffer = 0
    count = 0
    reachedMarker = false
    while (position + 1 < data.size && data.unsigned(position) == JpegMarker.PREFIX &&
      data.unsigned(position + 1) == JpegMarker.PREFIX
    ) {
      position += 1
    }
    if (position + 1 >= data.size || data.unsigned(position) != JpegMarker.PREFIX ||
      data.unsigned(position + 1) !in JpegMarker.RESTARTS
    ) {
      throw JpegMalformedException()
    }
    position += 2
  }

  private fun fill() {
    while (count <= FILL_LIMIT) {
      var byte = 0L
      if (!reachedMarker && position < data.size) {
        val current = data.unsigned(position)
        if (current != JpegMarker.PREFIX) {
          byte = current.toLong()
          position += 1
        } else if (position + 1 < data.size && data.unsigned(position + 1) == JpegMarker.STUFFING) {
          byte = current.toLong()
          position += 2
        } else {
          reachedMarker = true
        }
      }
      buffer = buffer or (byte shl (FILL_LIMIT - count))
      count += BYTE_BITS
    }
  }

  private companion object {
    const val BUFFER_BITS = 32
    const val BYTE_BITS = 8
    const val FILL_LIMIT = BUFFER_BITS - BYTE_BITS
  }
}

// ITU-T T.81 F.1.2.3, B.1.1.5
internal class EntropyWriter {
  private val output = ByteArrayOutputStream()
  private var buffer = 0L
  private var count = 0

  fun write(value: Int, length: Int) {
    if (length == 0) {
      return
    }
    buffer = buffer shl length or (value.toLong() and ((1L shl length) - 1))
    count += length
    while (count >= 8) {
      val byte = ((buffer shr (count - 8)) and 0xFF).toInt()
      output.write(byte)
      if (byte == JpegMarker.PREFIX) {
        output.write(JpegMarker.STUFFING)
      }
      count -= 8
      buffer = buffer and ((1L shl count) - 1)
    }
  }

  fun finish(): ByteArray {
    if (count > 0) {
      val padding = 8 - count
      write((1 shl padding) - 1, padding)
    }
    return output.toByteArray()
  }
}
