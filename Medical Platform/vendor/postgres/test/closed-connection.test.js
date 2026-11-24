// https://github.com/porsager/postgres/issues/1133, PEDIGREE.md úprava 2 a 3
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import { setTimeout as sleep } from 'node:timers/promises'
import esm from '../src/index.js'

const cjs = createRequire(import.meta.url)('../cjs/src/index.js')

const SETTLE_MS = 50
const PENDING_MS = 500
const PROTOCOL_VERSION = 196608
const QUERY = 'Q'.charCodeAt(0)
const PARSE = 'P'.charCodeAt(0)
const IDLE = 'I'
const IN_TRANSACTION = 'T'

function int16(value) {
  const bytes = Buffer.alloc(2)
  bytes.writeUInt16BE(value)
  return bytes
}

function int32(value) {
  const bytes = Buffer.alloc(4)
  bytes.writeUInt32BE(value)
  return bytes
}

function message(type, body = Buffer.alloc(0)) {
  return Buffer.concat([Buffer.from(type), int32(body.length + 4), body])
}

const sync = message('S')
const authenticationOk = message('R', int32(0))
const readyFor = status => message('Z', Buffer.from(status))
const commandComplete = tag => message('C', Buffer.from(tag + '\0'))
const columnX = message('T', Buffer.concat([
  int16(1), Buffer.from('x\0'), int32(0), int16(0), int32(25), int16(0xffff), int32(0xffffffff), int16(0)
]))
const dataRow = value => message('D', Buffer.concat([int16(1), int32(value.length), Buffer.from(value)]))
const fatal = (code, text) => message('E', Buffer.from('SFATAL\0VFATAL\0C' + code + '\0M' + text + '\0\0'))
const terminatedByAdministrator = fatal('57P01', 'terminating connection due to administrator command')
const startingUp = fatal('57P03', 'the database system is starting up')
const divisionByZero = message('E', Buffer.from('SERROR\0VERROR\0C' + '22012' + '\0Mdivision by zero\0\0'))
const emptyExtendedResult = Buffer.concat([
  message('1'), message('t', int16(0)), message('n'), message('2'), commandComplete('SELECT 0')
])
const suspendedCursor = Buffer.concat([
  message('1'), message('t', int16(0)), columnX, message('2'), dataRow('a'), message('s')
])

class Server extends EventEmitter {
  constructor({ replies = [], failsStartup = false }) {
    super()
    this.replies = replies
    this.failsStartup = failsStartup
    this.writes = []
    this.readyState = 'open'
    this.status = IDLE
  }

  write(chunk, callback) {
    const bytes = Buffer.from(chunk)
    this.writes.push(bytes)
    if (this.writes.length === 1 && this.failsStartup)
      setImmediate(() => this.close(startingUp))
    else if (this.writes.length === 1)
      setImmediate(() => this.emit('data', Buffer.concat([authenticationOk, readyFor(IDLE)])))
    else
      this.reply(bytes)
    callback && callback()
    return true
  }

  reply(bytes) {
    const text = bytes.toString('latin1')
    const [, custom] = this.replies.find(([pattern]) => pattern.test(text)) || []
    if (custom)
      return setImmediate(() => custom(this))
    if (bytes[0] === QUERY)
      return setImmediate(() => this.emit('data', this.simpleResult(text)))
    if (bytes[0] === PARSE && bytes.subarray(-sync.length).equals(sync))
      return setImmediate(() => this.emit('data', Buffer.concat([emptyExtendedResult, readyFor(this.status)])))
  }

  simpleResult(text) {
    if (/^Q.{4}begin/is.test(text))
      this.status = IN_TRANSACTION
    if (/^Q.{4}(commit|rollback)/is.test(text))
      this.status = IDLE
    return Buffer.concat([commandComplete('SELECT 0'), readyFor(this.status)])
  }

  received(text) {
    return this.writes.some(x => x.includes(text))
  }

  terminate() {
    this.emit('data', terminatedByAdministrator)
    this.readyState = 'closed'
    this.emit('close', false)
  }

  close(last) {
    if (this.readyState === 'closed')
      return

    last && this.emit('data', last)
    this.readyState = 'closed'
    setImmediate(() => this.emit('close', false))
  }

  end() {
    this.close()
  }

  destroy() {
    this.close()
  }

  setKeepAlive() {
    return this
  }
}

async function outcome(promise) {
  let timer
  const pending = new Promise(resolve => timer = setTimeout(resolve, PENDING_MS, 'pending'))
  try {
    return await Promise.race([promise.then(() => 'resolved', error => error.code), pending])
  } finally {
    clearTimeout(timer)
  }
}

describe.each([
  { build: 'src', postgres: esm, fetchTypes: false },
  { build: 'src', postgres: esm, fetchTypes: true },
  { build: 'cjs', postgres: cjs, fetchTypes: false },
  { build: 'cjs', postgres: cjs, fetchTypes: true }
])('a connection the server ends ($build, fetch_types $fetchTypes)', ({ postgres, fetchTypes }) => {
  const pools = []

  function pool({ replies, failsStartupFrom = Infinity } = {}) {
    const servers = []
    const sql = postgres({
      socket: () => {
        const server = new Server({ replies, failsStartup: servers.length >= failsStartupFrom })
        servers.push(server)
        return server
      },
      max: 1,
      fetch_types: fetchTypes,
      connect_timeout: 1,
      max_lifetime: null
    })
    pools.push(sql)
    return { sql, servers }
  }

  afterEach(async() => {
    await Promise.all(pools.splice(0).map(sql => sql.end({ timeout: 0 })))
  })

  it('úprava 2 starts the next session with its startup message alone', async() => {
    const { sql, servers } = pool()
    await sql.unsafe('select 0')
    const described = outcome(sql`select ${ 1 }::int`)
    await sleep(SETTLE_MS)

    servers[0].terminate()
    await outcome(sql.unsafe('select 2'))
    const [startup] = servers[1].writes

    expect(await described).toBe('CONNECTION_CLOSED')
    expect(startup.readUInt32BE(0)).toBe(startup.length)
    expect(startup.readUInt32BE(4)).toBe(PROTOCOL_VERSION)
  })

  it('úprava 2 does not reject the first query of the next session with the error of the ended one', async() => {
    const { sql, servers } = pool()
    await sql.unsafe('select 0')
    const described = outcome(sql`select ${ 1 }::int`)
    await sleep(SETTLE_MS)

    servers[0].terminate()

    expect(await described).toBe('CONNECTION_CLOSED')
    expect(await outcome(sql.unsafe('select 2'))).toBe('resolved')
  })

  it('úprava 2 rejects a statement of the transaction instead of running it in the next session', async() => {
    const { sql, servers } = pool()
    let waiting
    let statement
    let finished
    const callbackFinished = new Promise(resolve => finished = resolve)
    const transaction = outcome(sql.begin(async tx => {
      try {
        await tx.unsafe('select 1')
        waiting = outcome(sql.unsafe('select 2'))
        servers[0].terminate()
        await waiting
        statement = outcome(tx.unsafe('insert into outside_the_transaction default values'))
        await statement
      } finally {
        finished()
      }
    }))
    await callbackFinished

    expect(await transaction).toBe('CONNECTION_CLOSED')
    expect(await waiting).toBe('resolved')
    expect(await statement).toBe('CONNECTION_CLOSED')
    expect(servers).toHaveLength(2)
    expect(servers[1].received('outside_the_transaction')).toBe(false)
  })

  it('úprava 2 rejects a statement of the transaction while no new session is open', async() => {
    const { sql, servers } = pool()
    let statement
    let finished
    const callbackFinished = new Promise(resolve => finished = resolve)
    const transaction = outcome(sql.begin(async tx => {
      try {
        await tx.unsafe('select 1')
        servers[0].terminate()
        await sleep(SETTLE_MS)
        statement = outcome(tx.unsafe('insert into after_the_end default values'))
        await statement
      } finally {
        finished()
      }
    }))
    await callbackFinished

    expect(await transaction).toBe('CONNECTION_CLOSED')
    expect(await statement).toBe('CONNECTION_CLOSED')
    expect(servers).toHaveLength(1)
  })

  it('úprava 2 rejects a query of a reserved connection instead of running it in the next session', async() => {
    const { sql, servers } = pool()
    await sql.unsafe('select 0')
    const reserved = await sql.reserve()
    await reserved.unsafe('select 1')
    const waiting = outcome(sql.unsafe('select 2'))

    servers[0].terminate()

    expect(await waiting).toBe('resolved')
    expect(await outcome(reserved.unsafe('select pg_advisory_unlock_all()'))).toBe('CONNECTION_CLOSED')
    expect(servers).toHaveLength(2)
    expect(servers[1].received('pg_advisory_unlock_all')).toBe(false)
  })

  it('úprava 2 rejects a query queued on a reserved connection when the connection closes', async() => {
    const { sql, servers } = pool()
    await sql.unsafe('select 0')
    const reserved = await sql.reserve()
    const first = outcome(reserved`select ${ 1 }::int`)
    const queued = outcome(reserved`select ${ 2 }::int`)
    await sleep(SETTLE_MS)

    servers[0].terminate()

    expect(await first).toBe('CONNECTION_CLOSED')
    expect(await queued).toBe('CONNECTION_CLOSED')
  })

  it('úprava 2 keeps the pool working when a reserved connection is released after it closed', async() => {
    const { sql, servers } = pool()
    await sql.unsafe('select 0')
    const reserved = await sql.reserve()
    await reserved.unsafe('select 1')

    servers[0].terminate()
    await outcome(reserved.unsafe('select pg_advisory_unlock_all()'))
    reserved.release()

    expect(await outcome(sql.unsafe('select 2'))).toBe('resolved')
    expect(servers).toHaveLength(2)
  })

  it('úprava 2 ends the pool after the server ended a session with a query in flight', async() => {
    const { sql, servers } = pool()
    await sql.unsafe('select 0')
    const described = outcome(sql`select ${ 1 }::int`)
    await sleep(SETTLE_MS)

    servers[0].terminate()

    expect(await described).toBe('CONNECTION_CLOSED')
    expect(await outcome(sql.end())).toBe('resolved')
  })

  it('úprava 2 waits before it retries a session that fails at startup', async() => {
    const { sql, servers } = pool({ failsStartupFrom: 1 })
    await sql.unsafe('select 0')
    const described = outcome(sql`select ${ 1 }::int`)
    await sleep(SETTLE_MS)

    servers[0].terminate()

    expect(await described).toBe('CONNECTION_CLOSED')
    expect(await outcome(sql.unsafe('select 2'))).toBe('57P03')
    expect(servers).toHaveLength(2)
  })

  it('úprava 2 stops a callback cursor whose connection closed while the callback ran', async() => {
    const { sql, servers } = pool({ replies: [[/from cursor_rows/, server => server.emit('data', suspendedCursor)]] })
    await sql.unsafe('select 0')
    let batches = 0

    const cursor = outcome(sql.unsafe('select x from cursor_rows').cursor(1, async() => {
      batches++
      setImmediate(() => servers[0].terminate())
      await sleep(SETTLE_MS)
    }))

    expect(await cursor).toBe('CONNECTION_CLOSED')
    expect(batches).toBe(1)
  })

  it('úprava 2 rejects the iterator of a cursor whose connection closed', async() => {
    const { sql, servers } = pool({ replies: [[/from cursor_rows/, server => server.emit('data', suspendedCursor)]] })
    await sql.unsafe('select 0')
    let batches = 0

    const iterated = outcome((async() => {
      for await (const _ of sql.unsafe('select x from cursor_rows').cursor(1)) {
        batches++
        setImmediate(() => servers[0].terminate())
        await sleep(SETTLE_MS)
      }
    })())

    expect(await iterated).toBe('CONNECTION_CLOSED')
    expect(batches).toBe(1)
  })

  it('úprava 3 reads the first result after a result the server broke off with an error', async() => {
    const { sql } = pool({
      replies: [
        [/select broken/, server => server.emit('data', Buffer.concat([
          columnX, dataRow('a'), dataRow('b'), dataRow('c'), divisionByZero, readyFor(IDLE)
        ]))],
        [/select one/, server => server.emit('data', Buffer.concat([
          columnX, dataRow('only'), commandComplete('SELECT 1'), readyFor(IDLE)
        ]))]
      ]
    })
    await sql.unsafe('select 0')

    expect(await outcome(sql.unsafe('select broken'))).toBe('22012')
    expect([...await sql.unsafe('select one')]).toEqual([{ x: 'only' }])
  })

  it('úprava 3 reads the first result of the next session after the server ended one in the middle of a result', async() => {
    const { sql } = pool({
      replies: [
        [/select broken/, server => {
          server.emit('data', Buffer.concat([columnX, dataRow('a'), dataRow('b'), dataRow('c')]))
          server.terminate()
        }],
        [/select one/, server => server.emit('data', Buffer.concat([
          columnX, dataRow('only'), commandComplete('SELECT 1'), readyFor(IDLE)
        ]))]
      ]
    })
    await sql.unsafe('select 0')

    expect(await outcome(sql.unsafe('select broken'))).toBe('CONNECTION_CLOSED')
    expect([...await sql.unsafe('select one')]).toEqual([{ x: 'only' }])
  })
})
