import Foundation

enum Argon2 {
  struct Parameters {
    let memoryKiB: UInt32
    let passes: UInt32
    let parallelism: UInt32
    let tagLength: UInt32
  }

  enum Failure: Error {
    case invalidParameters
  }

  private static let version: UInt32 = 0x13
  private static let argon2idType: UInt32 = 2
  private static let blockWords = 128
  private static let blockBytes = blockWords * 8
  private static let syncPoints = 4
  private static let addressesPerBlock = 128
  private static let prehashBytes = 64
  private static let prehashSeedBytes = prehashBytes + 8
  private static let scratchWords = 3 * blockWords
  // RFC 9106 3.5
  private static let matrixSide = 8
  private static let registerWords = 2
  private static let rowWords = matrixSide * registerWords

  static func hash(
    password: [UInt8],
    salt: [UInt8],
    secret: [UInt8] = [],
    associatedData: [UInt8] = [],
    parameters: Parameters
  ) throws -> [UInt8] {
    let lanes = Int(parameters.parallelism)
    guard lanes >= 1, parameters.passes >= 1, parameters.tagLength >= 4, parameters.memoryKiB >= UInt32(8 * lanes) else {
      throw Failure.invalidParameters
    }
    let blockCount = Int(parameters.memoryKiB / UInt32(4 * lanes)) * 4 * lanes
    let laneLength = blockCount / lanes
    let segmentLength = laneLength / syncPoints

    var h0 = initialHash(password: password, salt: salt, secret: secret, associatedData: associatedData, parameters: parameters)
    var memory = [UInt64](repeating: 0, count: blockCount * blockWords)
    var seed = [UInt8](repeating: 0, count: prehashSeedBytes)
    seed.replaceSubrange(0 ..< prehashBytes, with: h0)
    for lane in 0 ..< lanes {
      for column in 0 ..< 2 {
        seed.replaceSubrange(prehashBytes ..< prehashBytes + 4, with: littleEndian(UInt32(column)))
        seed.replaceSubrange(prehashBytes + 4 ..< prehashSeedBytes, with: littleEndian(UInt32(lane)))
        let block = variableLengthHash(seed, outputLength: blockBytes)
        memory.withUnsafeMutableBufferPointer { buffer in
          storeBlock(block, into: buffer, at: lane * laneLength + column)
        }
      }
    }
    h0.withUnsafeMutableBufferPointer { $0.update(repeating: 0) }

    let context = Context(
      blockCount: blockCount, lanes: lanes, laneLength: laneLength, segmentLength: segmentLength, passes: Int(parameters.passes)
    )
    let scratch = UnsafeMutablePointer<UInt64>.allocate(capacity: scratchWords)
    scratch.initialize(repeating: 0, count: scratchWords)
    defer {
      scratch.update(repeating: 0, count: scratchWords)
      scratch.deallocate()
    }
    memory.withUnsafeMutableBufferPointer { buffer in
      for pass in 0 ..< context.passes {
        for slice in 0 ..< syncPoints {
          for lane in 0 ..< lanes {
            fillSegment(buffer, context: context, pass: pass, lane: lane, slice: slice, scratch: scratch)
          }
        }
      }
    }

    var final = [UInt64](repeating: 0, count: blockWords)
    for lane in 0 ..< lanes {
      let offset = (lane * laneLength + laneLength - 1) * blockWords
      for word in 0 ..< blockWords {
        final[word] ^= memory[offset + word]
      }
    }
    memory.withUnsafeMutableBufferPointer { $0.update(repeating: 0) }
    return variableLengthHash(bytes(of: final), outputLength: Int(parameters.tagLength))
  }

  private struct Context {
    let blockCount: Int
    let lanes: Int
    let laneLength: Int
    let segmentLength: Int
    let passes: Int
  }

  private struct Position {
    let pass: Int
    let lane: Int
    let slice: Int
    var index: Int
  }

  private static func initialHash(
    password: [UInt8], salt: [UInt8], secret: [UInt8], associatedData: [UInt8], parameters: Parameters
  ) -> [UInt8] {
    var input: [UInt8] = []
    input += littleEndian(parameters.parallelism)
    input += littleEndian(parameters.tagLength)
    input += littleEndian(parameters.memoryKiB)
    input += littleEndian(parameters.passes)
    input += littleEndian(version)
    input += littleEndian(argon2idType)
    for part in [password, salt, secret, associatedData] {
      input += littleEndian(UInt32(part.count))
      input += part
    }
    return Blake2b.hash(input, outputLength: prehashBytes)
  }

  static func variableLengthHash(_ input: [UInt8], outputLength: Int) -> [UInt8] {
    let prefixed = littleEndian(UInt32(outputLength)) + input
    if outputLength <= Blake2b.maximumOutput {
      return Blake2b.hash(prefixed, outputLength: outputLength)
    }
    let half = Blake2b.maximumOutput / 2
    let rounds = (outputLength + half - 1) / half - 2
    var output: [UInt8] = []
    var block = Blake2b.hash(prefixed, outputLength: Blake2b.maximumOutput)
    output += block[0 ..< half]
    for _ in 0 ..< rounds - 1 {
      block = Blake2b.hash(block, outputLength: Blake2b.maximumOutput)
      output += block[0 ..< half]
    }
    output += Blake2b.hash(block, outputLength: outputLength - rounds * half)
    return output
  }

  private static func fillSegment(
    _ memory: UnsafeMutableBufferPointer<UInt64>,
    context: Context,
    pass: Int,
    lane: Int,
    slice: Int,
    scratch: UnsafeMutablePointer<UInt64>
  ) {
    let dataIndependent = pass == 0 && slice < syncPoints / 2
    var addressBlock = [UInt64](repeating: 0, count: blockWords)
    var inputBlock = [UInt64](repeating: 0, count: blockWords)
    if dataIndependent {
      inputBlock[0] = UInt64(pass)
      inputBlock[1] = UInt64(lane)
      inputBlock[2] = UInt64(slice)
      inputBlock[3] = UInt64(context.blockCount)
      inputBlock[4] = UInt64(context.passes)
      inputBlock[5] = UInt64(argon2idType)
    }
    var position = Position(pass: pass, lane: lane, slice: slice, index: 0)
    if pass == 0 && slice == 0 {
      position.index = 2
      if dataIndependent {
        nextAddresses(&addressBlock, input: &inputBlock, scratch: scratch)
      }
    }
    var current = lane * context.laneLength + slice * context.segmentLength + position.index
    var previous = current % context.laneLength == 0 ? current + context.laneLength - 1 : current - 1
    while position.index < context.segmentLength {
      let pseudoRandom: UInt64
      if dataIndependent {
        if position.index % addressesPerBlock == 0 {
          nextAddresses(&addressBlock, input: &inputBlock, scratch: scratch)
        }
        pseudoRandom = addressBlock[position.index % addressesPerBlock]
      } else {
        pseudoRandom = memory[previous * blockWords]
      }
      let referenceLane = pass == 0 && slice == 0 ? lane : Int(pseudoRandom >> 32) % context.lanes
      let referenceIndex = referenceIndex(
        context: context, position: position, pseudoRandom: UInt32(truncatingIfNeeded: pseudoRandom), sameLane: referenceLane == lane
      )
      let reference = referenceLane * context.laneLength + referenceIndex
      fillBlock(memory, previous: previous, reference: reference, next: current, withXor: pass > 0, scratch: scratch)
      position.index += 1
      current += 1
      previous = current - 1
    }
  }

  private static func nextAddresses(
    _ addresses: inout [UInt64], input: inout [UInt64], scratch: UnsafeMutablePointer<UInt64>
  ) {
    input[6] += 1
    let zero = scratch + 2 * blockWords
    addresses.withUnsafeMutableBufferPointer { addressBuffer in
      input.withUnsafeBufferPointer { inputBuffer in
        compress(
          previous: zero, reference: inputBuffer.baseAddress!, into: addressBuffer.baseAddress!, withXor: false,
          scratch: scratch
        )
        compress(
          previous: zero, reference: addressBuffer.baseAddress!, into: addressBuffer.baseAddress!, withXor: false,
          scratch: scratch
        )
      }
    }
  }

  private static func referenceIndex(context: Context, position: Position, pseudoRandom: UInt32, sameLane: Bool) -> Int {
    let referenceArea: Int
    if position.pass == 0 {
      if position.slice == 0 {
        referenceArea = position.index - 1
      } else if sameLane {
        referenceArea = position.slice * context.segmentLength + position.index - 1
      } else {
        referenceArea = position.slice * context.segmentLength + (position.index == 0 ? -1 : 0)
      }
    } else if sameLane {
      referenceArea = context.laneLength - context.segmentLength + position.index - 1
    } else {
      referenceArea = context.laneLength - context.segmentLength + (position.index == 0 ? -1 : 0)
    }
    var relative = UInt64(pseudoRandom)
    relative = (relative * relative) >> 32
    relative = UInt64(referenceArea) - 1 - ((UInt64(referenceArea) * relative) >> 32)
    let start = position.pass == 0 ? 0 : (position.slice + 1) * context.segmentLength % context.laneLength
    return (start + Int(relative)) % context.laneLength
  }

  private static func fillBlock(
    _ memory: UnsafeMutableBufferPointer<UInt64>,
    previous: Int,
    reference: Int,
    next: Int,
    withXor: Bool,
    scratch: UnsafeMutablePointer<UInt64>
  ) {
    let base = memory.baseAddress!
    compress(
      previous: base + previous * blockWords, reference: base + reference * blockWords, into: base + next * blockWords,
      withXor: withXor, scratch: scratch
    )
  }

  // RFC 9106 3.5
  private static func compress(
    previous: UnsafePointer<UInt64>,
    reference: UnsafePointer<UInt64>,
    into next: UnsafeMutablePointer<UInt64>,
    withXor: Bool,
    scratch: UnsafeMutablePointer<UInt64>
  ) {
    let r = scratch
    let q = scratch + blockWords
    for word in 0 ..< blockWords {
      let value = previous[word] ^ reference[word]
      r[word] = value
      q[word] = value
    }
    for row in 0 ..< matrixSide {
      permute(q + row * rowWords, step: registerWords)
    }
    for column in 0 ..< matrixSide {
      permute(q + column * registerWords, step: rowWords)
    }
    for word in 0 ..< blockWords {
      let value = q[word] ^ r[word]
      next[word] = withXor ? next[word] ^ value : value
    }
  }

  // RFC 9106 3.6
  @inline(__always) private static func permute(_ v: UnsafeMutablePointer<UInt64>, step: Int) {
    @inline(__always) func at(_ index: Int) -> Int {
      (index >> 1) * step + (index & 1)
    }
    @inline(__always) func mix(_ a: Int, _ b: Int, _ c: Int, _ d: Int) {
      v[a] = v[a] &+ v[b] &+ 2 &* (v[a] & 0xffff_ffff) &* (v[b] & 0xffff_ffff)
      v[d] = rotateRight(v[d] ^ v[a], 32)
      v[c] = v[c] &+ v[d] &+ 2 &* (v[c] & 0xffff_ffff) &* (v[d] & 0xffff_ffff)
      v[b] = rotateRight(v[b] ^ v[c], 24)
      v[a] = v[a] &+ v[b] &+ 2 &* (v[a] & 0xffff_ffff) &* (v[b] & 0xffff_ffff)
      v[d] = rotateRight(v[d] ^ v[a], 16)
      v[c] = v[c] &+ v[d] &+ 2 &* (v[c] & 0xffff_ffff) &* (v[d] & 0xffff_ffff)
      v[b] = rotateRight(v[b] ^ v[c], 63)
    }
    mix(at(0), at(4), at(8), at(12))
    mix(at(1), at(5), at(9), at(13))
    mix(at(2), at(6), at(10), at(14))
    mix(at(3), at(7), at(11), at(15))
    mix(at(0), at(5), at(10), at(15))
    mix(at(1), at(6), at(11), at(12))
    mix(at(2), at(7), at(8), at(13))
    mix(at(3), at(4), at(9), at(14))
  }

  private static func storeBlock(_ block: [UInt8], into memory: UnsafeMutableBufferPointer<UInt64>, at index: Int) {
    for word in 0 ..< blockWords {
      var value: UInt64 = 0
      for byte in 0 ..< 8 {
        value |= UInt64(block[word * 8 + byte]) << (8 * UInt64(byte))
      }
      memory[index * blockWords + word] = value
    }
  }

  private static func bytes(of block: [UInt64]) -> [UInt8] {
    var out = [UInt8](repeating: 0, count: block.count * 8)
    for (word, value) in block.enumerated() {
      for byte in 0 ..< 8 {
        out[word * 8 + byte] = UInt8(truncatingIfNeeded: value >> (8 * UInt64(byte)))
      }
    }
    return out
  }

  @inline(__always) private static func rotateRight(_ value: UInt64, _ bits: UInt64) -> UInt64 {
    (value >> bits) | (value << (64 - bits))
  }

  private static func littleEndian(_ value: UInt32) -> [UInt8] {
    [UInt8(value & 0xff), UInt8((value >> 8) & 0xff), UInt8((value >> 16) & 0xff), UInt8((value >> 24) & 0xff)]
  }
}

enum Blake2b {
  static let maximumOutput = 64

  private static let iv: [UInt64] = [
    0x6a09_e667_f3bc_c908, 0xbb67_ae85_84ca_a73b, 0x3c6e_f372_fe94_f82b, 0xa54f_f53a_5f1d_36f1,
    0x510e_527f_ade6_82d1, 0x9b05_688c_2b3e_6c1f, 0x1f83_d9ab_fb41_bd6b, 0x5be0_cd19_137e_2179,
  ]
  private static let sigma: [[Int]] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
    [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
    [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
    [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
    [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
    [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
    [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
    [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
    [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
  ]
  private static let blockBytes = 128
  private static let rounds = 12

  static func hash(_ input: [UInt8], outputLength: Int) -> [UInt8] {
    precondition(outputLength >= 1 && outputLength <= maximumOutput)
    var h = iv
    h[0] ^= 0x0101_0000 ^ UInt64(outputLength)
    var offset = 0
    var counter: UInt64 = 0
    while input.count - offset > blockBytes {
      counter += UInt64(blockBytes)
      compress(&h, block: Array(input[offset ..< offset + blockBytes]), counter: counter, last: false)
      offset += blockBytes
    }
    let remaining = input.count - offset
    counter += UInt64(remaining)
    var last = Array(input[offset...])
    last += [UInt8](repeating: 0, count: blockBytes - remaining)
    compress(&h, block: last, counter: counter, last: true)
    var out: [UInt8] = []
    for word in h {
      for byte in 0 ..< 8 {
        out.append(UInt8(truncatingIfNeeded: word >> (8 * UInt64(byte))))
      }
    }
    return Array(out[0 ..< outputLength])
  }

  private static func compress(_ h: inout [UInt64], block: [UInt8], counter: UInt64, last: Bool) {
    var m = [UInt64](repeating: 0, count: 16)
    for word in 0 ..< 16 {
      for byte in 0 ..< 8 {
        m[word] |= UInt64(block[word * 8 + byte]) << (8 * UInt64(byte))
      }
    }
    var v = h + iv
    v[12] ^= counter
    if last {
      v[14] = ~v[14]
    }
    for round in 0 ..< rounds {
      let s = sigma[round % 10]
      mix(&v, 0, 4, 8, 12, m[s[0]], m[s[1]])
      mix(&v, 1, 5, 9, 13, m[s[2]], m[s[3]])
      mix(&v, 2, 6, 10, 14, m[s[4]], m[s[5]])
      mix(&v, 3, 7, 11, 15, m[s[6]], m[s[7]])
      mix(&v, 0, 5, 10, 15, m[s[8]], m[s[9]])
      mix(&v, 1, 6, 11, 12, m[s[10]], m[s[11]])
      mix(&v, 2, 7, 8, 13, m[s[12]], m[s[13]])
      mix(&v, 3, 4, 9, 14, m[s[14]], m[s[15]])
    }
    for index in 0 ..< 8 {
      h[index] ^= v[index] ^ v[index + 8]
    }
  }

  @inline(__always) private static func mix(_ v: inout [UInt64], _ a: Int, _ b: Int, _ c: Int, _ d: Int, _ x: UInt64, _ y: UInt64) {
    v[a] = v[a] &+ v[b] &+ x
    v[d] = rotateRight(v[d] ^ v[a], 32)
    v[c] = v[c] &+ v[d]
    v[b] = rotateRight(v[b] ^ v[c], 24)
    v[a] = v[a] &+ v[b] &+ y
    v[d] = rotateRight(v[d] ^ v[a], 16)
    v[c] = v[c] &+ v[d]
    v[b] = rotateRight(v[b] ^ v[c], 63)
  }

  @inline(__always) private static func rotateRight(_ value: UInt64, _ bits: UInt64) -> UInt64 {
    (value >> bits) | (value << (64 - bits))
  }
}
