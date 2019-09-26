import fs from 'fs'
import { join } from 'path'
import RedditAPI from 'reddit-wrapper-v2'
import { google, youtube_v3 } from 'googleapis'

const {
	REDDIT_USERNAME,
	REDDIT_PASSWORD,
	REDDIT_APP_ID,
	REDDIT_API_SECRET,
	GOOGLE_OAUTH_CLIENT_ID,
	GOOGLE_OAUTH_CLIENT_SECRET,
	GOOGLE_AUTHORIZATION_CODE,
	YOUTUBE_PLAYLIST_ID
} = process.env

const reddit = new RedditAPI({
	username: REDDIT_USERNAME,
	password: REDDIT_PASSWORD,
	app_id: REDDIT_APP_ID,
	api_secret: REDDIT_API_SECRET,
	retry_on_wait: true,
	retry_on_server_error: 5,
	retry_delay: 5,
	logs: true
})

async function* listing(endpoint) {
	let after = null
	let count = 0
	let children

	do {
		const [code, res] = await reddit.api.get(endpoint, {
			after,
			count
		})

		after = res.data.after

		children = res.data.children
		count += children.length

		if (children.length)
			yield children
	} while (after && children.length)

}

async function getRefreshToken() {
	try {
		const buffer = fs.readFileSync(join(__dirname, 'refresh_token'))
		return buffer.toString()
	} catch (_) {
		return null
	}
}

async function storeRefreshToken(token) {
	fs.writeFileSync(join(__dirname, 'refresh_token'), token)
}

(async () => {

	// Google oauth
	const oauth2Client = new google.auth.OAuth2(
		GOOGLE_OAUTH_CLIENT_ID,
		GOOGLE_OAUTH_CLIENT_SECRET,
		'http://127.0.0.1'
	)
	const refresh_token = await getRefreshToken()
	if (!refresh_token) {
		const { tokens } = await oauth2Client.getToken(GOOGLE_AUTHORIZATION_CODE)
		oauth2Client.setCredentials(tokens)
		console.log('New refresh token', tokens.refresh_token)
		await storeRefreshToken(tokens.refresh_token)
	} else {
		console.log('Using refresh token', refresh_token)
		oauth2Client.setCredentials({ refresh_token })
	}

	oauth2Client.on('tokens', async tokens => {
		if (tokens.refresh_token) {
			console.log('New refresh token', tokens.refresh_token)
			await storeRefreshToken(tokens.refresh_token)
		}
	})

	const ytb = new youtube_v3.Youtube({ auth: oauth2Client })

	for await (let posts of listing('/r/DeepIntoYoutube/')) {
		const filtered = posts
			.filter(({ data: { media } }) => media && media.type === 'youtube.com')

		const ids = filtered.map(({ data: { url } }) => [url, /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/.exec(url)])
			.filter(([url, res]) => {
				if (!res)
					console.error(`Can't find YouTube ID in url ${url}`)
				return res
			})
			.map(([, res]) => res[1])

			for (let id of ids) {

				const res = await ytb.playlistItems.list({
					part: 'id',
					playlistId: YOUTUBE_PLAYLIST_ID,
					videoId: id
				})

				if (!res.data.items.length)
				{
					await ytb.playlistItems.insert({
						part: 'id,snippet',
						resource: {
							snippet: {
								playlistId: YOUTUBE_PLAYLIST_ID,
								resourceId: { kind: 'youtube#video', videoId: id }
							}
						}
					})
					console.log(`Added video ${id} to the playlist.`)
				} else {
					console.log(`Video ${id} was already in the playlist.`)
				}
		}
	}

})()
	.catch(e => console.error('Unexpected error', e))
