package cz.veevoy.ansora.core.mobile

internal const val JPEG_BLOCK_SIDE = 8
internal const val JPEG_BLOCK_SIZE = 64

// ITU-T T.81 Figure A.6
internal val JPEG_ZIGZAG = intArrayOf(
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5,
  12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51,
  58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
)

internal class ComponentPlane(
  val id: Int,
  val horizontal: Int,
  val vertical: Int,
  val quantizationTable: Int,
  var dcTable: Int,
  var acTable: Int,
  val blocksWide: Int,
  val blocksHigh: Int,
  val coefficients: ShortArray,
) {
  fun blockIndex(x: Int, y: Int): Int = (y * blocksWide + x) * JPEG_BLOCK_SIZE

  fun reshaped(horizontal: Int, vertical: Int, blocksWide: Int, blocksHigh: Int, coefficients: ShortArray) =
    ComponentPlane(id, horizontal, vertical, quantizationTable, dcTable, acTable, blocksWide, blocksHigh, coefficients)
}

// ITU-T T.81 A.2.2, A.2.3
internal class ScanOrder(val components: IntArray, val bases: IntArray, val unitEnds: IntArray)

internal class CoefficientImage(
  val width: Int,
  val height: Int,
  val components: List<ComponentPlane>,
  val quantizationTables: Array<IntArray?>,
) {
  val maxHorizontal: Int get() = components.maxOf { it.horizontal }
  val maxVertical: Int get() = components.maxOf { it.vertical }
  val mcuWidth: Int get() = JPEG_BLOCK_SIDE * maxHorizontal
  val mcuHeight: Int get() = JPEG_BLOCK_SIDE * maxVertical
  val mcusWide: Int get() = (width + mcuWidth - 1) / mcuWidth
  val mcusHigh: Int get() = (height + mcuHeight - 1) / mcuHeight

  fun scanOrder(members: List<Int>): ScanOrder {
    val components = mutableListOf<Int>()
    val bases = mutableListOf<Int>()
    val unitEnds = mutableListOf<Int>()
    if (members.size == 1) {
      val member = members.first()
      val plane = this.components[member]
      val sampledWidth = (width * plane.horizontal + maxHorizontal - 1) / maxHorizontal
      val sampledHeight = (height * plane.vertical + maxVertical - 1) / maxVertical
      val wide = (sampledWidth + JPEG_BLOCK_SIDE - 1) / JPEG_BLOCK_SIDE
      val high = (sampledHeight + JPEG_BLOCK_SIDE - 1) / JPEG_BLOCK_SIDE
      for (y in 0 until high) {
        for (x in 0 until wide) {
          components.add(member)
          bases.add(plane.blockIndex(x, y))
          unitEnds.add(bases.size)
        }
      }
    } else {
      for (mcuY in 0 until mcusHigh) {
        for (mcuX in 0 until mcusWide) {
          for (member in members) {
            val plane = this.components[member]
            for (v in 0 until plane.vertical) {
              for (h in 0 until plane.horizontal) {
                components.add(member)
                bases.add(plane.blockIndex(mcuX * plane.horizontal + h, mcuY * plane.vertical + v))
              }
            }
          }
          unitEnds.add(bases.size)
        }
      }
    }
    return ScanOrder(components.toIntArray(), bases.toIntArray(), unitEnds.toIntArray())
  }

  // ITU-T T.81 F.1.2.1, F.1.2.2
  fun encoded(header: List<JpegSegment>): ByteArray {
    val order = scanOrder(components.indices.toList())
    val dcFrequencies = Array(BASELINE_TABLES) { IntArray(HuffmanTable.ALPHABET_SIZE) }
    val acFrequencies = Array(BASELINE_TABLES) { IntArray(HuffmanTable.ALPHABET_SIZE) }
    visitSymbols(order) { component, isDc, symbol, _, _ ->
      val plane = components[component]
      if (isDc) {
        dcFrequencies[plane.dcTable][symbol] += 1
      } else {
        acFrequencies[plane.acTable][symbol] += 1
      }
    }
    val dcSpecs = arrayOfNulls<HuffmanTable>(BASELINE_TABLES)
    val acSpecs = arrayOfNulls<HuffmanTable>(BASELINE_TABLES)
    for (slot in components.map { it.dcTable }.toSet()) {
      dcSpecs[slot] = HuffmanTable.optimal(dcFrequencies[slot])
    }
    for (slot in components.map { it.acTable }.toSet()) {
      acSpecs[slot] = HuffmanTable.optimal(acFrequencies[slot])
    }
    val dcEncoders = components.map { HuffmanEncoder(checkNotNull(dcSpecs[it.dcTable])) }
    val acEncoders = components.map { HuffmanEncoder(checkNotNull(acSpecs[it.acTable])) }
    val writer = EntropyWriter()
    visitSymbols(order) { component, isDc, symbol, extra, extraLength ->
      (if (isDc) dcEncoders[component] else acEncoders[component]).encode(symbol, writer)
      writer.write(extra, extraLength)
    }
    val segments: List<JpegSegment> = header + quantizationSegment() + frameSegment() + huffmanSegment(dcSpecs, acSpecs)
    val parts: List<JpegPart> = segments.map<JpegSegment, JpegPart> { JpegPart.Segment(it) } +
      JpegPart.Scan(JpegScan(scanHeader(), writer.finish()))
    return JpegFile(parts).serialized()
  }

  // ITU-T T.81 F.1.2.1.1, F.1.2.2.1
  private inline fun visitSymbols(
    order: ScanOrder,
    visit: (component: Int, isDc: Boolean, symbol: Int, extra: Int, extraLength: Int) -> Unit,
  ) {
    val predictors = IntArray(components.size)
    for (block in order.bases.indices) {
      val component = order.components[block]
      val values = components[component].coefficients
      val base = order.bases[block]
      val dc = values[base].toInt()
      val difference = dc - predictors[component]
      predictors[component] = dc
      val dcCategory = category(difference)
      visit(component, true, dcCategory, bitsOf(difference, dcCategory), dcCategory)
      var run = 0
      for (index in 1..LAST_COEFFICIENT) {
        val value = values[base + JPEG_ZIGZAG[index]].toInt()
        if (value == 0) {
          run += 1
          continue
        }
        while (run > MAXIMUM_RUN) {
          visit(component, false, ZERO_RUN_LENGTH, 0, 0)
          run -= ZERO_RUN_LENGTH_SPAN
        }
        val size = category(value)
        visit(component, false, run shl NIBBLE_BITS or size, bitsOf(value, size), size)
        run = 0
      }
      if (run > 0) {
        visit(component, false, END_OF_BLOCK, 0, 0)
      }
    }
  }

  private fun quantizationSegment(): JpegSegment {
    val payload = mutableListOf<Byte>()
    for (slot in components.map { it.quantizationTable }.toSortedSet()) {
      val table = quantizationTables[slot] ?: continue
      payload.add(slot.toByte())
      JPEG_ZIGZAG.forEach { payload.add(table[it].toByte()) }
    }
    return JpegSegment(JpegMarker.QUANTIZATION_TABLES, payload.toByteArray())
  }

  private fun frameSegment(): JpegSegment {
    val payload = mutableListOf(
      BASELINE_PRECISION, height shr 8, height and 0xFF, width shr 8, width and 0xFF, components.size,
    )
    for (plane in components) {
      payload.addAll(listOf(plane.id, plane.horizontal shl NIBBLE_BITS or plane.vertical, plane.quantizationTable))
    }
    return JpegSegment(JpegMarker.BASELINE_FRAME, payload.map { it.toByte() }.toByteArray())
  }

  private fun huffmanSegment(dc: Array<HuffmanTable?>, ac: Array<HuffmanTable?>): JpegSegment {
    val payload = mutableListOf<Byte>()
    dc.forEachIndexed { slot, table ->
      if (table != null) {
        payload.add((DC_TABLE_CLASS shl NIBBLE_BITS or slot).toByte())
        payload.addAll(table.serialized.toList())
      }
    }
    ac.forEachIndexed { slot, table ->
      if (table != null) {
        payload.add((AC_TABLE_CLASS shl NIBBLE_BITS or slot).toByte())
        payload.addAll(table.serialized.toList())
      }
    }
    return JpegSegment(JpegMarker.HUFFMAN_TABLES, payload.toByteArray())
  }

  private fun scanHeader(): ByteArray {
    val header = mutableListOf(components.size)
    for (plane in components) {
      header.addAll(listOf(plane.id, plane.dcTable shl NIBBLE_BITS or plane.acTable))
    }
    header.addAll(listOf(0, LAST_COEFFICIENT, 0))
    return header.map { it.toByte() }.toByteArray()
  }

  companion object {
    private const val BASELINE_PRECISION = 8
    private const val MAXIMUM_SAMPLING_FACTOR = 4
    private const val MAXIMUM_COMPONENTS = 4
    private const val MAXIMUM_TABLES = 4
    private const val BASELINE_TABLES = 2
    private const val DC_TABLE_CLASS = 0
    private const val AC_TABLE_CLASS = 1
    private const val LAST_COEFFICIENT = 63
    private const val MAXIMUM_DC_CATEGORY = 11
    private const val MAXIMUM_AC_CATEGORY = 10
    private const val NIBBLE_BITS = 4
    private const val LOW_NIBBLE = 0x0F
    private const val MAXIMUM_RUN = 15
    private const val ZERO_RUN_LENGTH_SPAN = MAXIMUM_RUN + 1

    // ITU-T T.81 F.1.2.2.1
    private const val ZERO_RUN_LENGTH = 0xF0
    private const val END_OF_BLOCK = 0x00

    // ITU-T T.81 B.2.2, B.2.3
    private const val FRAME_HEADER_BYTES = 6
    private const val FRAME_COMPONENT_BYTES = 3
    private const val SCAN_COUNT_BYTES = 1
    private const val SCAN_COMPONENT_BYTES = 2
    private const val SCAN_SPECTRAL_BYTES = 3

    // ITU-T T.81 A.2.2, A.2.3
    fun decode(file: JpegFile): CoefficientImage {
      if (file.frameMarker != JpegMarker.BASELINE_FRAME) {
        throw JpegUnsupportedException()
      }
      var image: CoefficientImage? = null
      val quantizationTables = arrayOfNulls<IntArray>(MAXIMUM_TABLES)
      val dcTables = arrayOfNulls<HuffmanDecoder>(MAXIMUM_TABLES)
      val acTables = arrayOfNulls<HuffmanDecoder>(MAXIMUM_TABLES)
      var restartInterval = 0
      for (part in file.parts) {
        when (part) {
          is JpegPart.Segment -> {
            val segment = part.segment
            when (segment.marker) {
              JpegMarker.QUANTIZATION_TABLES -> readQuantizationTables(segment.payload, quantizationTables)
              JpegMarker.HUFFMAN_TABLES -> readHuffmanTables(segment.payload, dcTables, acTables)
              JpegMarker.RESTART_INTERVAL -> {
                if (segment.payload.size != 2) {
                  throw JpegMalformedException()
                }
                restartInterval = segment.payload.unsigned(0) shl 8 or segment.payload.unsigned(1)
              }
              JpegMarker.BASELINE_FRAME -> image = frame(segment.payload, quantizationTables)
            }
          }
          is JpegPart.Scan -> {
            val current = image ?: throw JpegMalformedException()
            current.decodeScan(part.scan, dcTables, acTables, restartInterval)
          }
        }
      }
      val decoded = image ?: throw JpegMalformedException()
      if (decoded.components.any { quantizationTables[it.quantizationTable] == null }) {
        throw JpegMalformedException()
      }
      return decoded
    }

    private fun frame(payload: ByteArray, quantizationTables: Array<IntArray?>): CoefficientImage {
      if (payload.size < FRAME_HEADER_BYTES || payload.unsigned(0) != BASELINE_PRECISION) {
        throw JpegUnsupportedException()
      }
      val height = payload.unsigned(1) shl 8 or payload.unsigned(2)
      val width = payload.unsigned(3) shl 8 or payload.unsigned(4)
      val count = payload.unsigned(5)
      if (height <= 0 || width <= 0 || count !in 1..MAXIMUM_COMPONENTS ||
        payload.size != FRAME_HEADER_BYTES + count * FRAME_COMPONENT_BYTES
      ) {
        throw JpegUnsupportedException()
      }
      val declared = (0 until count).map { index ->
        val offset = FRAME_HEADER_BYTES + index * FRAME_COMPONENT_BYTES
        val horizontal = payload.unsigned(offset + 1) shr NIBBLE_BITS
        val vertical = payload.unsigned(offset + 1) and LOW_NIBBLE
        val quantizationTable = payload.unsigned(offset + 2)
        if (horizontal !in 1..MAXIMUM_SAMPLING_FACTOR || vertical !in 1..MAXIMUM_SAMPLING_FACTOR ||
          quantizationTable >= MAXIMUM_TABLES
        ) {
          throw JpegMalformedException()
        }
        ComponentPlane(payload.unsigned(offset), horizontal, vertical, quantizationTable, 0, 0, 0, 0, ShortArray(0))
      }
      val shape = CoefficientImage(width, height, declared, quantizationTables)
      val components = declared.map { plane ->
        val blocksWide = shape.mcusWide * plane.horizontal
        val blocksHigh = shape.mcusHigh * plane.vertical
        val coefficients = ShortArray(blocksWide * blocksHigh * JPEG_BLOCK_SIZE)
        plane.reshaped(plane.horizontal, plane.vertical, blocksWide, blocksHigh, coefficients)
      }
      return CoefficientImage(width, height, components, quantizationTables)
    }

    private fun readQuantizationTables(payload: ByteArray, tables: Array<IntArray?>) {
      var offset = 0
      while (offset < payload.size) {
        val precision = payload.unsigned(offset) shr NIBBLE_BITS
        val slot = payload.unsigned(offset) and LOW_NIBBLE
        if (precision != 0 || slot >= MAXIMUM_TABLES || offset + 1 + JPEG_BLOCK_SIZE > payload.size) {
          throw JpegUnsupportedException()
        }
        val table = IntArray(JPEG_BLOCK_SIZE)
        for (index in 0 until JPEG_BLOCK_SIZE) {
          table[JPEG_ZIGZAG[index]] = payload.unsigned(offset + 1 + index)
        }
        tables[slot] = table
        offset += 1 + JPEG_BLOCK_SIZE
      }
    }

    private fun readHuffmanTables(
      payload: ByteArray,
      dc: Array<HuffmanDecoder?>,
      ac: Array<HuffmanDecoder?>,
    ) {
      var offset = 0
      while (offset < payload.size) {
        val tableClass = payload.unsigned(offset) shr NIBBLE_BITS
        val slot = payload.unsigned(offset) and LOW_NIBBLE
        if (tableClass > AC_TABLE_CLASS || slot >= BASELINE_TABLES) {
          throw JpegUnsupportedException()
        }
        val (table, length) = HuffmanTable.parse(payload, offset + 1)
        val decoder = HuffmanDecoder(table)
        if (tableClass == DC_TABLE_CLASS) dc[slot] = decoder else ac[slot] = decoder
        offset += 1 + length
      }
    }

    // ITU-T T.81 F.2.2
    private fun decodeBlock(
      coefficients: ShortArray,
      base: Int,
      dc: HuffmanDecoder,
      ac: HuffmanDecoder,
      predictors: IntArray,
      component: Int,
      reader: EntropyReader,
    ) {
      val category = dc.decode(reader)
      if (category > MAXIMUM_DC_CATEGORY) {
        throw JpegMalformedException()
      }
      predictors[component] += extended(reader.bits(category), category)
      coefficients[base] = predictors[component].coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
      var index = 1
      while (index <= LAST_COEFFICIENT) {
        val symbol = ac.decode(reader)
        val run = symbol shr NIBBLE_BITS
        val size = symbol and LOW_NIBBLE
        if (size == 0) {
          if (symbol != ZERO_RUN_LENGTH) {
            return
          }
          index += ZERO_RUN_LENGTH_SPAN
          continue
        }
        index += run
        if (index > LAST_COEFFICIENT || size > MAXIMUM_AC_CATEGORY) {
          throw JpegMalformedException()
        }
        coefficients[base + JPEG_ZIGZAG[index]] = extended(reader.bits(size), size).toShort()
        index += 1
      }
    }

    // ITU-T T.81 F.2.2.1 EXTEND
    private fun extended(value: Int, category: Int): Int {
      if (category == 0) {
        return 0
      }
      return if (value < (1 shl (category - 1))) value - (1 shl category) + 1 else value
    }

    private fun category(value: Int): Int {
      var magnitude = Math.abs(value)
      var category = 0
      while (magnitude > 0) {
        category += 1
        magnitude = magnitude shr 1
      }
      return category
    }

    private fun bitsOf(value: Int, category: Int): Int = if (value >= 0) value else value + (1 shl category) - 1
  }

  // ITU-T T.81 B.2.3, A.2
  private fun decodeScan(
    scan: JpegScan,
    dcTables: Array<HuffmanDecoder?>,
    acTables: Array<HuffmanDecoder?>,
    restartInterval: Int,
  ) {
    val header = scan.header
    val count = if (header.isEmpty()) 0 else header.unsigned(0)
    val spectralEnd = SCAN_COUNT_BYTES + count * SCAN_COMPONENT_BYTES
    if (count < 1 || header.size != spectralEnd + SCAN_SPECTRAL_BYTES) {
      throw JpegMalformedException()
    }
    if (header.unsigned(spectralEnd) != 0 || header.unsigned(spectralEnd + 1) != LAST_COEFFICIENT ||
      header.unsigned(spectralEnd + 2) != 0
    ) {
      throw JpegUnsupportedException()
    }
    val members = (0 until count).map { index ->
      val offset = SCAN_COUNT_BYTES + index * SCAN_COMPONENT_BYTES
      val id = header.unsigned(offset)
      val selectors = header.unsigned(offset + 1)
      val member = components.indexOfFirst { it.id == id }
      if (member < 0) {
        throw JpegMalformedException()
      }
      components[member].dcTable = selectors shr NIBBLE_BITS
      components[member].acTable = selectors and LOW_NIBBLE
      if (components[member].dcTable >= BASELINE_TABLES || components[member].acTable >= BASELINE_TABLES ||
        dcTables[components[member].dcTable] == null || acTables[components[member].acTable] == null
      ) {
        throw JpegMalformedException()
      }
      member
    }
    val order = scanOrder(members)
    val dcDecoders = components.map { dcTables[it.dcTable] }
    val acDecoders = components.map { acTables[it.acTable] }
    val reader = EntropyReader(scan.entropyData)
    var predictors = IntArray(components.size)
    var block = 0
    for (unit in order.unitEnds.indices) {
      if (restartInterval > 0 && unit > 0 && unit % restartInterval == 0) {
        reader.restart()
        predictors = IntArray(components.size)
      }
      while (block < order.unitEnds[unit]) {
        val component = order.components[block]
        decodeBlock(
          components[component].coefficients, order.bases[block],
          dcDecoders[component] ?: throw JpegMalformedException(),
          acDecoders[component] ?: throw JpegMalformedException(),
          predictors, component, reader,
        )
        block += 1
      }
    }
  }
}
