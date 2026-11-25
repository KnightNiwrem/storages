import { LibSQLAdapter } from 'jsr:@grammyjs/storage-libsql'
import { createClient } from 'npm:@libsql/client'
import { Bot, type Context, session, type SessionFlavor } from 'npm:grammy'

interface SessionData {
	counter: number
}

type MyContext = Context & SessionFlavor<SessionData>

const client = createClient({
	url: Deno.env.get('TURSO_DATABASE_URL')!,
	authToken: Deno.env.get('TURSO_AUTH_TOKEN'),
})

const bot = new Bot<MyContext>(Deno.env.get('BOT_TOKEN')!)

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
