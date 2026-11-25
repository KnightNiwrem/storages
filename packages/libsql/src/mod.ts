import type { Client } from '@libsql/client'
import type { StorageAdapter } from 'grammy/web'

const DEFAULT_TABLE_NAME = 'sessions'

export interface LibSQLAdapterOptions {
	client: Client
	tableName?: string
}

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`
}

/**
 * Storage adapter for libSQL (Turso).
 */
export class LibSQLAdapter<T> implements StorageAdapter<T> {
	private readonly client: Client
	private readonly tableName: string

	constructor(options: LibSQLAdapterOptions) {
		if (!options?.client) {
			throw new Error('You must specify a libSQL client.')
		}

		const tableName = options.tableName ?? DEFAULT_TABLE_NAME
		if (!tableName) {
			throw new Error('Table name must not be empty.')
		}

		this.client = options.client
		this.tableName = quoteIdentifier(tableName)
	}

	async read(key: string): Promise<T | undefined> {
		const result = await this.client.execute({
			sql: `SELECT "value" FROM ${this.tableName} WHERE "key" = ? LIMIT 1`,
			args: [key],
		})

		const value = result.rows[0]?.value
		if (value == null) {
			return undefined
		}

		if (typeof value !== 'string') {
			throw new TypeError(`Unexpected value type for key "${key}": expected string`)
		}

		return JSON.parse(value) as T
	}

	async write(key: string, value: T): Promise<void> {
		await this.client.execute({
			sql: `INSERT INTO ${this.tableName} ("key", "value") VALUES (?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value"`,
			args: [key, JSON.stringify(value)],
		})
	}

	async delete(key: string): Promise<void> {
		await this.client.execute({
			sql: `DELETE FROM ${this.tableName} WHERE "key" = ?`,
			args: [key],
		})
	}

	async has(key: string): Promise<boolean> {
		const result = await this.client.execute({
			sql: `SELECT 1 FROM ${this.tableName} WHERE "key" = ? LIMIT 1`,
			args: [key],
		})

		return result.rows.length > 0
	}
}
