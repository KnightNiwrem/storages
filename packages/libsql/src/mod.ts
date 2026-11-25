import type { Client } from '@libsql/client'
import type { StorageAdapter } from 'grammy/web'

const DEFAULT_TABLE_NAME = 'sessions'

/**
 * Options for configuring {@link LibSQLAdapter}.
 */
export interface LibSQLAdapterOptions {
	/**
	 * A libSQL client created via `createClient()` from `@libsql/client` (or `@libsql/client/web`).
	 * The caller owns the client lifecycle; the adapter never closes it.
	 */
	client: Client
	/**
	 * Unqualified table name where sessions are stored. Defaults to `'sessions'`.
	 * Quoted as a single SQLite identifier (dots are treated literally, not as a schema qualifier).
	 */
	tableName?: string
}

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`
}

/**
 * Storage adapter for libSQL (Turso).
 *
 * Expects the target table to exist beforehand with `"key"` (primary key or unique `TEXT`)
 * and `"value"` (`TEXT NOT NULL`) columns, storing JSON-serialized session values.
 */
export class LibSQLAdapter<T> implements StorageAdapter<T> {
	private readonly client: Client
	private readonly tableName: string

	/**
	 * Creates a new libSQL storage adapter without running any startup queries.
	 *
	 * @throws {Error} If `options.client` is missing or `options.tableName` is empty.
	 */
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

	/**
	 * Reads and JSON-parses the session value for `key`, returning `undefined` if no row exists.
	 *
	 * @throws {TypeError} If the stored `"value"` column is not a string (including SQL `NULL`).
	 * @throws {SyntaxError} If the stored string is not valid JSON.
	 */
	async read(key: string): Promise<T | undefined> {
		const result = await this.client.execute({
			sql: `SELECT "value" FROM ${this.tableName} WHERE "key" = ? LIMIT 1`,
			args: [key],
		})

		const [row] = result.rows
		if (!row) {
			return undefined
		}

		const { value } = row
		if (typeof value !== 'string') {
			throw new TypeError(`Unexpected value type for key "${key}": expected string`)
		}

		return JSON.parse(value) as T
	}

	/**
	 * Upserts the JSON-serialized session `value` for `key`.
	 */
	async write(key: string, value: T): Promise<void> {
		await this.client.execute({
			sql: `INSERT INTO ${this.tableName} ("key", "value") VALUES (?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value"`,
			args: [key, JSON.stringify(value)],
		})
	}

	/**
	 * Deletes the session row for `key`, if present.
	 */
	async delete(key: string): Promise<void> {
		await this.client.execute({
			sql: `DELETE FROM ${this.tableName} WHERE "key" = ?`,
			args: [key],
		})
	}

	/**
	 * Returns `true` if a row exists for `key`, or `false` otherwise.
	 */
	async has(key: string): Promise<boolean> {
		const result = await this.client.execute({
			sql: `SELECT 1 FROM ${this.tableName} WHERE "key" = ? LIMIT 1`,
			args: [key],
		})

		return result.rows.length > 0
	}
}
