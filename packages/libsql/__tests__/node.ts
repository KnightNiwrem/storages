import assert from 'node:assert/strict'
import test from 'node:test'

import { createBot, createMessage } from '@grammyjs/storage-utils'
import { type Client, createClient } from '@libsql/client'
import { session } from 'grammy'

import { LibSQLAdapter } from '../src/mod.ts'

async function createTestClient(tableName = 'sessions'): Promise<Client> {
	const client = createClient({ url: ':memory:' })
	const escaped = `"${tableName.replaceAll('"', '""')}"`
	await client.execute(`
		CREATE TABLE IF NOT EXISTS ${escaped} (
			"key" TEXT PRIMARY KEY,
			"value" TEXT NOT NULL
		)
	`)
	return client
}

test('throws on invalid constructor arguments', () => {
	assert.throws(() => new LibSQLAdapter({} as never), /client/i)
	assert.throws(() => new LibSQLAdapter({ client: {} as Client, tableName: '' }), /Table name/i)
})

test('does not execute queries when constructed', () => {
	let executed = false
	const mockClient = {
		execute: (): never => {
			executed = true
			throw new Error('should not be called')
		},
	} as unknown as Client

	const adapter = new LibSQLAdapter({ client: mockClient })
	assert.ok(adapter)
	assert.equal(executed, false)
})

test('adapter CRUD operations with default table name', async (t) => {
	const client = await createTestClient()
	t.after(() => client.close())

	const adapter = new LibSQLAdapter<{ pizzaCount: number }>({ client })

	assert.equal(await adapter.read('chat:1'), undefined)
	assert.equal(await adapter.has('chat:1'), false)

	await adapter.write('chat:1', { pizzaCount: 1 })
	assert.deepEqual(await adapter.read('chat:1'), { pizzaCount: 1 })
	assert.equal(await adapter.has('chat:1'), true)

	await adapter.write('chat:1', { pizzaCount: 42 })
	assert.deepEqual(await adapter.read('chat:1'), { pizzaCount: 42 })

	await adapter.delete('chat:1')
	assert.equal(await adapter.read('chat:1'), undefined)
	assert.equal(await adapter.has('chat:1'), false)
})

test('supports special characters in table names and keys', async (t) => {
	for (const tableName of ['a-b.c$d', 'my"sessions']) {
		const client = await createTestClient(tableName)
		t.after(() => client.close())

		const adapter = new LibSQLAdapter<Record<string, number>>({ client, tableName })
		const key = 'x-y.z$w'

		await adapter.write(key, { count: 7 })
		assert.deepEqual(await adapter.read(key), { count: 7 })
		assert.equal(await adapter.has(key), true)

		await adapter.delete(key)
		assert.equal(await adapter.read(key), undefined)
	}
})

test('handles falsy JSON values', async (t) => {
	const client = await createTestClient()
	t.after(() => client.close())

	const adapter = new LibSQLAdapter<unknown>({ client })

	for (const value of [0, false, '', null]) {
		await adapter.write('falsy', value)
		assert.deepEqual(await adapter.read('falsy'), value)
		assert.equal(await adapter.has('falsy'), true)
	}
})

test('propagates invalid stored JSON and unexpected value types', async (t) => {
	const client = createClient({ url: ':memory:' })
	t.after(() => client.close())
	await client.execute('CREATE TABLE "sessions" ("key" TEXT PRIMARY KEY, "value" TEXT)')

	await client.execute({
		sql: 'INSERT INTO "sessions" ("key", "value") VALUES (?, ?)',
		args: ['broken', '{'],
	})
	await client.execute({
		sql: 'INSERT INTO "sessions" ("key", "value") VALUES (?, ?)',
		args: ['blob', new Uint8Array([1, 2, 3])],
	})
	await client.execute({
		sql: 'INSERT INTO "sessions" ("key", "value") VALUES (?, ?)',
		args: ['null-value', null],
	})

	const adapter = new LibSQLAdapter({ client })

	await assert.rejects(adapter.read('broken'), SyntaxError)
	await assert.rejects(adapter.read('blob'), TypeError)
	assert.equal(await adapter.has('null-value'), true)
	await assert.rejects(adapter.read('null-value'), TypeError)
})

test('pizza counter session test', async (t) => {
	const client = await createTestClient()
	t.after(() => client.close())

	const bot = createBot()

	bot.use(
		session({
			initial: () => ({ pizzaCount: 0 }),
			storage: new LibSQLAdapter({ client }),
		})
	)

	bot.hears('first', (ctx) => {
		assert.equal(ctx.session.pizzaCount, 0)
		ctx.session.pizzaCount = Number(ctx.session.pizzaCount) + 1
	})

	bot.hears('second', (ctx) => {
		assert.equal(ctx.session.pizzaCount, 1)
	})

	await bot.handleUpdate(createMessage(bot, 'first').update)
	await bot.handleUpdate(createMessage(bot, 'second').update)
})

test('simple string session test', async (t) => {
	const client = await createTestClient('custom_sessions')
	t.after(() => client.close())

	const bot = createBot(false)

	bot.use(
		session({
			initial: () => 'test',
			storage: new LibSQLAdapter<string>({ client, tableName: 'custom_sessions' }),
		})
	)

	bot.hears('first', (ctx) => {
		ctx.session = `${ctx.session} edited`
	})

	bot.hears('second', (ctx) => {
		assert.equal(ctx.session, 'test edited')
	})

	bot.hears('delete', (ctx) => {
		ctx.session = undefined
	})

	bot.hears('after-delete', (ctx) => {
		assert.equal(ctx.session, 'test')
	})

	await bot.handleUpdate(createMessage(bot, 'first').update)
	await bot.handleUpdate(createMessage(bot, 'second').update)
	await bot.handleUpdate(createMessage(bot, 'delete').update)
	await bot.handleUpdate(createMessage(bot, 'after-delete').update)
})
