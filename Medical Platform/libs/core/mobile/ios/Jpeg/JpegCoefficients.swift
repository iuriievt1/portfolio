import Foundation

let jpegBlockSide = 8
let jpegBlockSize = 64

// ITU-T T.81 Figure A.6
let jpegZigzag: [Int] = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5,
  12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51,
  58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
]

struct ComponentPlane {
  let id: UInt8
  var horizontal: Int
  var vertical: Int
  let quantizationTable: Int
  var dcTable = 0
  var acTable = 0
  var blocksWide: Int
  var blocksHigh: Int
  var coefficients: [Int16]

  func blockIndex(x: Int, y: Int) -> Int {
    (y * blocksWide + x) * jpegBlockSize
  }
}

struct CoefficientImage {
  private static let baselinePrecision = 8
  private static let maximumSamplingFactor = 4
  private static let maximumComponents = 4
  private static let maximumTables = 4
  private static let baselineTables = 2
  private static let dcTableClass = 0
  private static let acTableClass = 1
  private static let lastCoefficient = 63
  private static let maximumDcCategory = 11
  private static let maximumAcCategory = 10
  private static let nibbleBits = 4
  private static let lowNibble = 0x0F
  private static let maximumRun = 15
  private static let zeroRunLengthSpan = maximumRun + 1
  // ITU-T T.81 F.1.2.2.1
  private static let zeroRunLength = 0xF0
  private static let endOfBlock = 0x00
  // ITU-T T.81 B.2.2, B.2.3
  private static let frameHeaderBytes = 6
  private static let frameComponentBytes = 3
  private static let scanCountBytes = 1
  private static let scanComponentBytes = 2
  private static let scanSpectralBytes = 3

  var width: Int
  var height: Int
  var components: [ComponentPlane]
  var quantizationTables: [[UInt16]?]

  var maxHorizontal: Int { components.map(\.horizontal).max() ?? 1 }
  var maxVertical: Int { components.map(\.vertical).max() ?? 1 }
  var mcuWidth: Int { jpegBlockSide * maxHorizontal }
  var mcuHeight: Int { jpegBlockSide * maxVertical }
  var mcusWide: Int { (width + mcuWidth - 1) / mcuWidth }
  var mcusHigh: Int { (height + mcuHeight - 1) / mcuHeight }

  // ITU-T T.81 A.2.2, A.2.3
  static func decode(_ file: JpegFile) throws -> CoefficientImage {
    guard file.frameMarker == JpegMarker.baselineFrame else {
      throw JpegFailure.unsupported
    }
    var image: CoefficientImage?
    var quantizationTables = [[UInt16]?](repeating: nil, count: maximumTables)
    var dcTables = [HuffmanDecoder?](repeating: nil, count: maximumTables)
    var acTables = [HuffmanDecoder?](repeating: nil, count: maximumTables)
    var restartInterval = 0
    for part in file.parts {
      switch part {
      case let .segment(segment):
        switch segment.marker {
        case JpegMarker.quantizationTables:
          try readQuantizationTables(segment.payload, into: &quantizationTables)
        case JpegMarker.huffmanTables:
          try readHuffmanTables(segment.payload, dc: &dcTables, ac: &acTables)
        case JpegMarker.restartInterval:
          guard segment.payload.count == 2 else {
            throw JpegFailure.malformed
          }
          restartInterval = Int(segment.payload[0]) << 8 | Int(segment.payload[1])
        case JpegMarker.baselineFrame:
          image = try frame(segment.payload)
        default:
          continue
        }
      case let .scan(scan):
        guard var current = image else {
          throw JpegFailure.malformed
        }
        try current.decodeScan(scan, dcTables: dcTables, acTables: acTables, restartInterval: restartInterval)
        image = current
      }
    }
    guard var decoded = image else {
      throw JpegFailure.malformed
    }
    decoded.quantizationTables = quantizationTables
    for component in decoded.components where quantizationTables[component.quantizationTable] == nil {
      throw JpegFailure.malformed
    }
    return decoded
  }

  private static func frame(_ payload: [UInt8]) throws -> CoefficientImage {
    guard payload.count >= frameHeaderBytes, Int(payload[0]) == baselinePrecision else {
      throw JpegFailure.unsupported
    }
    let height = Int(payload[1]) << 8 | Int(payload[2])
    let width = Int(payload[3]) << 8 | Int(payload[4])
    let count = Int(payload[5])
    guard height > 0, width > 0, (1...maximumComponents).contains(count),
      payload.count == frameHeaderBytes + count * frameComponentBytes
    else {
      throw JpegFailure.unsupported
    }
    var components: [ComponentPlane] = []
    for index in 0..<count {
      let offset = frameHeaderBytes + index * frameComponentBytes
      let horizontal = Int(payload[offset + 1]) >> nibbleBits
      let vertical = Int(payload[offset + 1]) & lowNibble
      let quantizationTable = Int(payload[offset + 2])
      guard (1...maximumSamplingFactor).contains(horizontal), (1...maximumSamplingFactor).contains(vertical),
        quantizationTable < maximumTables
      else {
        throw JpegFailure.malformed
      }
      components.append(
        ComponentPlane(
          id: payload[offset], horizontal: horizontal, vertical: vertical, quantizationTable: quantizationTable,
          blocksWide: 0, blocksHigh: 0, coefficients: []))
    }
    var image = CoefficientImage(width: width, height: height, components: components, quantizationTables: [])
    for index in image.components.indices {
      image.components[index].blocksWide = image.mcusWide * image.components[index].horizontal
      image.components[index].blocksHigh = image.mcusHigh * image.components[index].vertical
      image.components[index].coefficients = [Int16](
        repeating: 0, count: image.components[index].blocksWide * image.components[index].blocksHigh * jpegBlockSize)
    }
    return image
  }

  private static func readQuantizationTables(_ payload: [UInt8], into tables: inout [[UInt16]?]) throws {
    var offset = 0
    while offset < payload.count {
      let precision = Int(payload[offset]) >> nibbleBits
      let slot = Int(payload[offset]) & lowNibble
      guard precision == 0, slot < maximumTables, offset + 1 + jpegBlockSize <= payload.count else {
        throw JpegFailure.unsupported
      }
      var table = [UInt16](repeating: 0, count: jpegBlockSize)
      for index in 0..<jpegBlockSize {
        table[jpegZigzag[index]] = UInt16(payload[offset + 1 + index])
      }
      tables[slot] = table
      offset += 1 + jpegBlockSize
    }
  }

  private static func readHuffmanTables(
    _ payload: [UInt8], dc: inout [HuffmanDecoder?], ac: inout [HuffmanDecoder?]
  ) throws {
    var offset = 0
    while offset < payload.count {
      let tableClass = Int(payload[offset]) >> nibbleBits
      let slot = Int(payload[offset]) & lowNibble
      guard tableClass <= acTableClass, slot < baselineTables else {
        throw JpegFailure.unsupported
      }
      let parsed = try HuffmanTable.parse(payload[(offset + 1)...])
      let decoder = try HuffmanDecoder(parsed.table)
      if tableClass == dcTableClass {
        dc[slot] = decoder
      } else {
        ac[slot] = decoder
      }
      offset += 1 + parsed.length
    }
  }

  // ITU-T T.81 B.2.3, A.2
  private mutating func decodeScan(
    _ scan: JpegScan, dcTables: [HuffmanDecoder?], acTables: [HuffmanDecoder?], restartInterval: Int
  ) throws {
    let header = scan.header
    guard let count = header.first.map(Int.init), count >= 1 else {
      throw JpegFailure.malformed
    }
    let spectralEnd = CoefficientImage.scanCountBytes + count * CoefficientImage.scanComponentBytes
    guard header.count == spectralEnd + CoefficientImage.scanSpectralBytes else {
      throw JpegFailure.malformed
    }
    guard header[spectralEnd] == 0, Int(header[spectralEnd + 1]) == CoefficientImage.lastCoefficient,
      header[spectralEnd + 2] == 0
    else {
      throw JpegFailure.unsupported
    }
    var members: [Int] = []
    for index in 0..<count {
      let offset = CoefficientImage.scanCountBytes + index * CoefficientImage.scanComponentBytes
      let id = header[offset]
      let selectors = Int(header[offset + 1])
      guard let member = components.firstIndex(where: { $0.id == id }) else {
        throw JpegFailure.malformed
      }
      components[member].dcTable = selectors >> CoefficientImage.nibbleBits
      components[member].acTable = selectors & CoefficientImage.lowNibble
      guard components[member].dcTable < CoefficientImage.baselineTables,
        components[member].acTable < CoefficientImage.baselineTables,
        dcTables[components[member].dcTable] != nil, acTables[components[member].acTable] != nil
      else {
        throw JpegFailure.malformed
      }
      members.append(member)
    }
    let order = scanOrder(members)
    let offsets = coefficientOffsets()
    var values = flattenedCoefficients()
    let dcDecoders = components.map { dcTables[$0.dcTable] }
    let acDecoders = components.map { acTables[$0.acTable] }
    let reader = EntropyReader(scan.entropyData)
    let zigzag = jpegZigzag
    try values.withUnsafeMutableBufferPointer { values in
      var predictors = [Int](repeating: 0, count: offsets.count)
      var block = 0
      for unit in order.unitEnds.indices {
        if restartInterval > 0, unit > 0, unit % restartInterval == 0 {
          try reader.restart()
          predictors = [Int](repeating: 0, count: offsets.count)
        }
        while block < order.unitEnds[unit] {
          let component = order.components[block]
          guard let dc = dcDecoders[component], let ac = acDecoders[component] else {
            throw JpegFailure.malformed
          }
          try CoefficientImage.decodeBlock(
            into: values, at: offsets[component] + order.bases[block], dc: dc, ac: ac, zigzag: zigzag,
            predictor: &predictors[component], reader: reader)
          block += 1
        }
      }
    }
    storeCoefficients(values, offsets: offsets)
  }

  // ITU-T T.81 A.2.2, A.2.3
  struct ScanOrder {
    var components: [Int] = []
    var bases: [Int] = []
    var unitEnds: [Int] = []

    mutating func append(component: Int, base: Int) {
      components.append(component)
      bases.append(base)
    }

    mutating func closeUnit() {
      unitEnds.append(bases.count)
    }
  }

  func scanOrder(_ members: [Int]) -> ScanOrder {
    var order = ScanOrder()
    if members.count == 1, let member = members.first {
      let plane = components[member]
      let sampledWidth = (width * plane.horizontal + maxHorizontal - 1) / maxHorizontal
      let sampledHeight = (height * plane.vertical + maxVertical - 1) / maxVertical
      let wide = (sampledWidth + jpegBlockSide - 1) / jpegBlockSide
      let high = (sampledHeight + jpegBlockSide - 1) / jpegBlockSide
      for y in 0..<high {
        for x in 0..<wide {
          order.append(component: member, base: plane.blockIndex(x: x, y: y))
          order.closeUnit()
        }
      }
      return order
    }
    for mcuY in 0..<mcusHigh {
      for mcuX in 0..<mcusWide {
        for member in members {
          let plane = components[member]
          for v in 0..<plane.vertical {
            for h in 0..<plane.horizontal {
              order.append(
                component: member, base: plane.blockIndex(x: mcuX * plane.horizontal + h, y: mcuY * plane.vertical + v))
            }
          }
        }
        order.closeUnit()
      }
    }
    return order
  }

  private func coefficientOffsets() -> [Int] {
    var offsets: [Int] = []
    var total = 0
    for plane in components {
      offsets.append(total)
      total += plane.coefficients.count
    }
    return offsets
  }

  private func flattenedCoefficients() -> [Int16] {
    var values: [Int16] = []
    values.reserveCapacity(components.reduce(0) { $0 + $1.coefficients.count })
    for plane in components {
      values.append(contentsOf: plane.coefficients)
    }
    return values
  }

  private mutating func storeCoefficients(_ values: [Int16], offsets: [Int]) {
    for index in components.indices {
      let start = offsets[index]
      components[index].coefficients = Array(values[start..<(start + components[index].coefficients.count)])
    }
  }

  // ITU-T T.81 F.2.2
  private static func decodeBlock(
    into coefficients: UnsafeMutableBufferPointer<Int16>, at base: Int, dc: HuffmanDecoder, ac: HuffmanDecoder,
    zigzag: [Int], predictor: inout Int, reader: EntropyReader
  ) throws {
    let category = Int(try dc.decode(reader))
    guard category <= maximumDcCategory else {
      throw JpegFailure.malformed
    }
    predictor += extended(reader.bits(category), category: category)
    coefficients[base] = Int16(clamping: predictor)
    var index = 1
    while index <= lastCoefficient {
      let symbol = Int(try ac.decode(reader))
      let run = symbol >> nibbleBits
      let size = symbol & lowNibble
      if size == 0 {
        guard symbol == zeroRunLength else {
          return
        }
        index += zeroRunLengthSpan
        continue
      }
      index += run
      guard index <= lastCoefficient, size <= maximumAcCategory else {
        throw JpegFailure.malformed
      }
      coefficients[base + zigzag[index]] = Int16(clamping: extended(reader.bits(size), category: size))
      index += 1
    }
  }

  // ITU-T T.81 F.2.2.1 EXTEND
  private static func extended(_ value: Int, category: Int) -> Int {
    guard category > 0 else {
      return 0
    }
    return value < (1 << (category - 1)) ? value - (1 << category) + 1 : value
  }

  // ITU-T T.81 F.1.2.1, F.1.2.2
  func encoded(header: [JpegSegment]) throws -> [UInt8] {
    let order = scanOrder(Array(components.indices))
    let offsets = coefficientOffsets()
    let values = flattenedCoefficients()
    let dcSlots = components.map(\.dcTable)
    let acSlots = components.map(\.acTable)
    var dcFrequencies = [[Int]](
      repeating: [Int](repeating: 0, count: HuffmanTable.alphabetSize), count: CoefficientImage.baselineTables)
    var acFrequencies = dcFrequencies
    values.withUnsafeBufferPointer { values in
      CoefficientImage.visitSymbols(order, values, offsets) { component, isDc, symbol, _, _ in
        if isDc {
          dcFrequencies[dcSlots[component]][symbol] += 1
        } else {
          acFrequencies[acSlots[component]][symbol] += 1
        }
      }
    }
    var dcSpecs = [HuffmanTable?](repeating: nil, count: CoefficientImage.baselineTables)
    var acSpecs = dcSpecs
    var dcBySlot: [Int: HuffmanEncoder] = [:]
    var acBySlot: [Int: HuffmanEncoder] = [:]
    for slot in Set(dcSlots) {
      let table = try HuffmanTable.optimal(frequencies: dcFrequencies[slot])
      dcSpecs[slot] = table
      dcBySlot[slot] = try HuffmanEncoder(table)
    }
    for slot in Set(acSlots) {
      let table = try HuffmanTable.optimal(frequencies: acFrequencies[slot])
      acSpecs[slot] = table
      acBySlot[slot] = try HuffmanEncoder(table)
    }
    let dcEncoders = dcSlots.compactMap { dcBySlot[$0] }
    let acEncoders = acSlots.compactMap { acBySlot[$0] }
    let writer = EntropyWriter()
    values.withUnsafeBufferPointer { values in
      CoefficientImage.visitSymbols(order, values, offsets) { component, isDc, symbol, extra, extraLength in
        let encoder = isDc ? dcEncoders[component] : acEncoders[component]
        encoder.encode(symbol, to: writer)
        writer.write(extra, length: extraLength)
      }
    }
    var segments = header
    segments.append(quantizationSegment())
    segments.append(frameSegment())
    segments.append(huffmanSegment(dc: dcSpecs, ac: acSpecs))
    var parts = segments.map(JpegPart.segment)
    parts.append(.scan(JpegScan(header: scanHeader(), entropyData: writer.finish())))
    return try JpegFile(parts: parts).serialized()
  }

  // ITU-T T.81 F.1.2.1.1, F.1.2.2.1
  private static func visitSymbols(
    _ order: ScanOrder, _ values: UnsafeBufferPointer<Int16>, _ offsets: [Int],
    _ visit: (_ component: Int, _ isDc: Bool, _ symbol: Int, _ extra: Int, _ extraLength: Int) -> Void
  ) {
    let zigzag = jpegZigzag
    var predictors = [Int](repeating: 0, count: offsets.count)
    for block in order.bases.indices {
      let component = order.components[block]
      let base = offsets[component] + order.bases[block]
      let dc = Int(values[base])
      let difference = dc - predictors[component]
      predictors[component] = dc
      let dcCategory = category(of: difference)
      visit(component, true, dcCategory, bits(of: difference, category: dcCategory), dcCategory)
      var run = 0
      for index in 1...lastCoefficient {
        let value = Int(values[base + zigzag[index]])
        if value == 0 {
          run += 1
          continue
        }
        while run > maximumRun {
          visit(component, false, zeroRunLength, 0, 0)
          run -= zeroRunLengthSpan
        }
        let size = category(of: value)
        visit(component, false, run << nibbleBits | size, bits(of: value, category: size), size)
        run = 0
      }
      if run > 0 {
        visit(component, false, endOfBlock, 0, 0)
      }
    }
  }

  private static func category(of value: Int) -> Int {
    var magnitude = abs(value)
    var category = 0
    while magnitude > 0 {
      category += 1
      magnitude >>= 1
    }
    return category
  }

  private static func bits(of value: Int, category: Int) -> Int {
    value >= 0 ? value : value + (1 << category) - 1
  }

  private func quantizationSegment() -> JpegSegment {
    var payload: [UInt8] = []
    for slot in Set(components.map(\.quantizationTable)).sorted() {
      guard let table = quantizationTables[slot] else {
        continue
      }
      payload.append(UInt8(slot))
      payload.append(contentsOf: jpegZigzag.map { UInt8(table[$0]) })
    }
    return JpegSegment(marker: JpegMarker.quantizationTables, payload: payload)
  }

  private func frameSegment() -> JpegSegment {
    var payload: [UInt8] = [
      UInt8(CoefficientImage.baselinePrecision), UInt8(height >> 8), UInt8(height & 0xFF),
      UInt8(width >> 8), UInt8(width & 0xFF), UInt8(components.count),
    ]
    for plane in components {
      let factors = UInt8(plane.horizontal << CoefficientImage.nibbleBits | plane.vertical)
      payload.append(contentsOf: [plane.id, factors, UInt8(plane.quantizationTable)])
    }
    return JpegSegment(marker: JpegMarker.baselineFrame, payload: payload)
  }

  private func huffmanSegment(dc: [HuffmanTable?], ac: [HuffmanTable?]) -> JpegSegment {
    var payload: [UInt8] = []
    for (slot, table) in dc.enumerated() {
      if let table {
        payload.append(UInt8(CoefficientImage.dcTableClass << CoefficientImage.nibbleBits | slot))
        payload.append(contentsOf: table.serialized)
      }
    }
    for (slot, table) in ac.enumerated() {
      if let table {
        payload.append(UInt8(CoefficientImage.acTableClass << CoefficientImage.nibbleBits | slot))
        payload.append(contentsOf: table.serialized)
      }
    }
    return JpegSegment(marker: JpegMarker.huffmanTables, payload: payload)
  }

  private func scanHeader() -> [UInt8] {
    var header: [UInt8] = [UInt8(components.count)]
    for plane in components {
      header.append(contentsOf: [plane.id, UInt8(plane.dcTable << CoefficientImage.nibbleBits | plane.acTable)])
    }
    header.append(contentsOf: [0, UInt8(CoefficientImage.lastCoefficient), 0])
    return header
  }
}
