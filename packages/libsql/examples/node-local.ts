import { LibSQLAdapter } from '@grammyjs/storage-libsql'
import { createClient } from '@libsql/client'
import { Bot, type Context, session, type SessionFlavor } from 'grammy'

interface SessionData {
	counter: number
}

type MyContext = Context & SessionFlavor<SessionData>

const client = createClient({
	url: 'file:sessions.db',
})

await client.execute(`
	CREATE TABLE IF NOT EXISTS "sessions" (
		"key" TEXT PRIMARY KEY,
		"value" TEXT NOT NULL
	)
`)

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!)

bot.use(
	session({
		initial: (): SessionData => ({ counter: 0 }),
		storage: new LibSQLAdapter<SessionData>({
			client,
			tableName: 'sessions',
		}),
	})
)

bot.command('stats', (ctx) => ctx.reply(`Already got ${ctx.session.counter} photos!`))
bot.on(':photo', (ctx) => {
	ctx.session.counter++
})

bot.start()
