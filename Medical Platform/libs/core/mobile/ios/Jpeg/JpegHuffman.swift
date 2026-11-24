import Foundation

// ITU-T T.81 B.2.4.2
struct HuffmanTable {
  static let maximumCodeLength = 16
  static let alphabetSize = 256
  private static let longestUnadjustedCodeLength = 32

  let counts: [Int]
  let symbols: [UInt8]

  static func parse(_ payload: ArraySlice<UInt8>) throws -> (table: HuffmanTable, length: Int) {
    guard payload.count >= maximumCodeLength else {
      throw JpegFailure.malformed
    }
    let start = payload.startIndex
    let counts = (0..<maximumCodeLength).map { Int(payload[start + $0]) }
    let total = counts.reduce(0, +)
    guard payload.count >= maximumCodeLength + total else {
      throw JpegFailure.malformed
    }
    let symbolsStart = start + maximumCodeLength
    let symbols = Array(payload[symbolsStart..<(symbolsStart + total)])
    return (HuffmanTable(counts: counts, symbols: symbols), maximumCodeLength + total)
  }

  var serialized: [UInt8] {
    counts.map { UInt8($0) } + symbols
  }

  // ITU-T T.81 C.2
  func codes() throws -> [(symbol: UInt8, code: Int, length: Int)] {
    var result: [(symbol: UInt8, code: Int, length: Int)] = []
    var code = 0
    var index = 0
    for length in 1...HuffmanTable.maximumCodeLength {
      for _ in 0..<counts[length - 1] {
        guard code < (1 << length) else {
          throw JpegFailure.malformed
        }
        result.append((symbols[index], code, length))
        code += 1
        index += 1
      }
      code <<= 1
    }
    return result
  }

  // ITU-T T.81 K.2
  static func optimal(frequencies: [Int]) throws -> HuffmanTable {
    let reserved = alphabetSize
    var frequency = frequencies + [1]
    var codeSize = [Int](repeating: 0, count: alphabetSize + 1)
    var others = [Int](repeating: -1, count: alphabetSize + 1)
    while true {
      var first = -1
      var least = Int.max
      for symbol in 0...reserved where frequency[symbol] != 0 && frequency[symbol] <= least {
        least = frequency[symbol]
        first = symbol
      }
      var second = -1
      least = Int.max
      for symbol in 0...reserved where frequency[symbol] != 0 && frequency[symbol] <= least && symbol != first {
        least = frequency[symbol]
        second = symbol
      }
      if second < 0 {
        break
      }
      frequency[first] += frequency[second]
      frequency[second] = 0
      codeSize[first] += 1
      while others[first] >= 0 {
        first = others[first]
        codeSize[first] += 1
      }
      others[first] = second
      codeSize[second] += 1
      while others[second] >= 0 {
        second = others[second]
        codeSize[second] += 1
      }
    }
    let longest = longestUnadjustedCodeLength
    var bits = [Int](repeating: 0, count: longest + 1)
    for symbol in 0...reserved where codeSize[symbol] > 0 {
      guard codeSize[symbol] <= longest else {
        throw JpegFailure.unsupported
      }
      bits[codeSize[symbol]] += 1
    }
    var length = longest
    while length > maximumCodeLength {
      while bits[length] > 0 {
        var shorter = length - 2
        while bits[shorter] == 0 {
          shorter -= 1
        }
        bits[length] -= 2
        bits[length - 1] += 1
        bits[shorter + 1] += 2
        bits[shorter] -= 1
      }
      length -= 1
    }
    var last = maximumCodeLength
    while bits[last] == 0 {
      last -= 1
    }
    bits[last] -= 1
    var symbols: [UInt8] = []
    for size in 1...longest {
      for symbol in 0..<reserved where codeSize[symbol] == size {
        symbols.append(UInt8(symbol))
      }
    }
    return HuffmanTable(counts: Array(bits[1...maximumCodeLength]), symbols: symbols)
  }
}

struct HuffmanDecoder {
  private static let lookaheadBits = 9

  private let lookup: [UInt16]
  private let maximumCode: [Int]
  private let valueOffset: [Int]
  private let symbols: [UInt8]

  init(_ table: HuffmanTable) throws {
    let codes = try table.codes()
    var lookup = [UInt16](repeating: 0, count: 1 << HuffmanDecoder.lookaheadBits)
    var maximumCode = [Int](repeating: -1, count: HuffmanTable.maximumCodeLength + 1)
    var valueOffset = [Int](repeating: 0, count: HuffmanTable.maximumCodeLength + 1)
    for (index, entry) in codes.enumerated() {
      if maximumCode[entry.length] < 0 {
        valueOffset[entry.length] = index - entry.code
      }
      maximumCode[entry.length] = entry.code
      guard entry.length <= HuffmanDecoder.lookaheadBits else {
        continue
      }
      let spread = HuffmanDecoder.lookaheadBits - entry.length
      let first = entry.code << spread
      for slot in first..<(first + (1 << spread)) {
        lookup[slot] = UInt16(entry.length) << 8 | UInt16(entry.symbol)
      }
    }
    self.lookup = lookup
    self.maximumCode = maximumCode
    self.valueOffset = valueOffset
    self.symbols = table.symbols
  }

  // ITU-T T.81 F.2.2.3
  func decode(_ reader: EntropyReader) throws -> UInt8 {
    let entry = lookup[reader.peek(HuffmanDecoder.lookaheadBits)]
    if entry != 0 {
      reader.skip(Int(entry >> 8))
      return UInt8(entry & 0xFF)
    }
    var code = reader.bits(HuffmanDecoder.lookaheadBits)
    for length in (HuffmanDecoder.lookaheadBits + 1)...HuffmanTable.maximumCodeLength {
      code = code << 1 | reader.bits(1)
      if code <= maximumCode[length] {
        return symbols[valueOffset[length] + code]
      }
    }
    throw JpegFailure.malformed
  }
}

struct HuffmanEncoder {
  private let codes: [Int]
  private let lengths: [Int]

  init(_ table: HuffmanTable) throws {
    var codes = [Int](repeating: 0, count: HuffmanTable.alphabetSize)
    var lengths = [Int](repeating: 0, count: HuffmanTable.alphabetSize)
    for entry in try table.codes() {
      codes[Int(entry.symbol)] = entry.code
      lengths[Int(entry.symbol)] = entry.length
    }
    self.codes = codes
    self.lengths = lengths
  }

  func encode(_ symbol: Int, to writer: EntropyWriter) {
    writer.write(codes[symbol], length: lengths[symbol])
  }
}

// ITU-T T.81 F.2.2.5, B.1.1.5
final class EntropyReader {
  private static let bufferBits = 32
  private static let byteBits = 8
  private static let fillLimit = bufferBits - byteBits

  private let data: [UInt8]
  private var position = 0
  private var buffer: UInt32 = 0
  private var count = 0
  private var reachedMarker = false

  init(_ data: [UInt8]) {
    self.data = data
  }

  func peek(_ length: Int) -> Int {
    if count < length {
      fill()
    }
    return Int(buffer >> (EntropyReader.bufferBits - length))
  }

  func skip(_ length: Int) {
    buffer <<= length
    count -= length
  }

  func bits(_ length: Int) -> Int {
    guard length > 0 else {
      return 0
    }
    let value = peek(length)
    skip(length)
    return value
  }

  // ITU-T T.81 F.2.2.5
  func restart() throws {
    buffer = 0
    count = 0
    reachedMarker = false
    while position + 1 < data.count, data[position] == JpegMarker.prefix, data[position + 1] == JpegMarker.prefix {
      position += 1
    }
    guard position + 1 < data.count, data[position] == JpegMarker.prefix,
      JpegMarker.restarts.contains(data[position + 1])
    else {
      throw JpegFailure.malformed
    }
    position += 2
  }

  private func fill() {
    while count <= EntropyReader.fillLimit {
      var byte: UInt32 = 0
      if !reachedMarker, position < data.count {
        let current = data[position]
        if current != JpegMarker.prefix {
          byte = UInt32(current)
          position += 1
        } else if position + 1 < data.count, data[position + 1] == JpegMarker.stuffing {
          byte = UInt32(current)
          position += 2
        } else {
          reachedMarker = true
        }
      }
      buffer |= byte << UInt32(EntropyReader.fillLimit - count)
      count += EntropyReader.byteBits
    }
  }
}

// ITU-T T.81 F.1.2.3, B.1.1.5
final class EntropyWriter {
  private(set) var bytes: [UInt8] = []
  private var buffer = 0
  private var count = 0

  func write(_ value: Int, length: Int) {
    guard length > 0 else {
      return
    }
    buffer = buffer << length | (value & ((1 << length) - 1))
    count += length
    while count >= 8 {
      let byte = UInt8((buffer >> (count - 8)) & 0xFF)
      bytes.append(byte)
      if byte == JpegMarker.prefix {
        bytes.append(JpegMarker.stuffing)
      }
      count -= 8
      buffer &= (1 << count) - 1
    }
  }

  func finish() -> [UInt8] {
    if count > 0 {
      let padding = 8 - count
      write((1 << padding) - 1, length: padding)
    }
    return bytes
  }
}
