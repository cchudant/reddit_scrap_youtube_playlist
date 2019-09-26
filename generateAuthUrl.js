import { google } from 'googleapis'

const {
	GOOGLE_OAUTH_CLIENT_ID,
	GOOGLE_OAUTH_CLIENT_SECRET
} = process.env

const oauth2Client = new google.auth.OAuth2(
	GOOGLE_OAUTH_CLIENT_ID,
	GOOGLE_OAUTH_CLIENT_SECRET,
	'http://127.0.0.1'
)

const scope = [
	'https://www.googleapis.com/auth/youtube',
]

const url = oauth2Client.generateAuthUrl({
	access_type: 'offline',
	scope
})

console.log('Go to this URL and allow the app to access your youtube account:')
console.log(url)
console.log('You will be redirected to a URL that looks like this: http://127.0.0.1?code=XXX')
console.log('Write the code in the .env file and name the environment variable GOOGLE_AUTHORIZATION_CODE')
