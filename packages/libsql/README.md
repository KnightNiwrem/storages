# libSQL storage adapter for grammY

Storage adapter that can be used to
[store your session data](https://grammy.dev/plugins/session.html) in
[libSQL](https://github.com/tursodatabase/libsql) / [Turso](https://turso.tech/)
when using sessions.

Works with `@libsql/client` (Node.js, Deno, Bun, local SQLite files, and remote
Turso databases) as well as `@libsql/client/web` in serverless and edge runtimes.

## Installation

This package is published to both [npm](https://www.npmjs.com/package/@grammyjs/storage-libsql) and [JSR](https://jsr.io/@grammyjs/storage-libsql) under the same name.

Node

```bash
npm install @grammyjs/storage-libsql @libsql/client --save
# or via JSR (npm compatibility layer):
# npx jsr add @grammyjs/storage-libsql
```

```ts
import { LibSQLAdapter } from '@grammyjs/storage-libsql'
```

Deno

```bash
deno add jsr:@grammyjs/storage-libsql npm:@libsql/client
```

```ts
import { LibSQLAdapter } from 'jsr:@grammyjs/storage-libsql'
```

Bun

```bash
bun add @grammyjs/storage-libsql @libsql/client
```

```ts
import { LibSQLAdapter } from '@grammyjs/storage-libsql'
```

## Database setup

Create the sessions table before constructing the adapter. The adapter never
runs DDL queries on startup, which avoids extra round-trips on serverless cold
starts.

```sql
CREATE TABLE IF NOT EXISTS "sessions" (
	"key" TEXT PRIMARY KEY,
	"value" TEXT NOT NULL
);
```

Replace `"sessions"` with your preferred table name if you pass a custom
`tableName` option.

## Usage

You can check the
[examples](https://github.com/grammyjs/storages/tree/main/packages/libsql/examples)
folder, or see a simple example below.

```ts
import { LibSQLAdapter } from '@grammyjs/storage-libsql'
import { createClient } from '@libsql/client'
import { Bot, type Context, session, type SessionFlavor } from 'grammy'

interface SessionData {
	pizzaCount: number
}

type MyContext = Context & SessionFlavor<SessionData>

const client = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN,
})

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!)

bot.use(
	session({
		initial: (): SessionData => ({ pizzaCount: 0 }),
		storage: new LibSQLAdapter<SessionData>({
			client,
			tableName: 'sessions',
		}),
	})
)

bot.start()
```

For edge runtimes (such as Cloudflare Workers or Vercel Edge), create the client
using `@libsql/client/web` and pass it to `LibSQLAdapter` in the same way.

## Configuration

The `LibSQLAdapter` constructor accepts an options object with:

- `client` (required): A libSQL `Client` instance created via `createClient()`
  from `@libsql/client` (or `@libsql/client/web`)
- `tableName` (optional): The unqualified name of the table where sessions are
  stored. Defaults to `'sessions'`. Quoted as a single SQLite identifier (dots
  are treated literally rather than as a schema qualifier)

The adapter does not create, close, or otherwise manage the supplied `Client`
connection.
