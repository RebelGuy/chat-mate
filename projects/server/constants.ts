// see https://dev.twitch.tv/docs/authentication/scopes for available scopes.
// see https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/ to determine which scope an event subscription needs.
// see docs/twitch-auth.md for more info
// if you change the scopes here, streamers may be required to re-authorise the ChatMate Application in Studio to get access to the new events.
// you will also need to re-authenticate the ChatMate admin channel on Twitch via Studio.
export const TWITCH_STREAMER_SCOPE = [
  'chat:read',
  'chat:edit',

  // for subscribing to mod/unmod events
  'moderation:read',
  'moderator:manage:banned_users',

  // for modding/unmodding users and listening to ban/unban events
  'channel:manage:moderators',
  'channel:moderate',

  // for subscribing to follow events
  'moderator:read:followers'
]

export const TWITCH_ADMIN_SCOPE = TWITCH_STREAMER_SCOPE

// we only need to read the user info, which does not require any scopes
export const TWITCH_USER_SCOPE = []

export const YOUTUBE_ADMIN_SCOPE = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.readonly'
]

export const YOUTUBE_STREAMER_SCOPE = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.readonly'
]

export const YOUTUBE_USER_SCOPE = [
  'https://www.googleapis.com/auth/youtube.readonly'
]

// https://dev.streamlabs.com/docs/currency-codes
export const CURRENCIES = {
  AUD: 'Australian Dollar',
  BRL: 'Brazilian Real',
  CAD: 'Canadian Dollar',
  CZK: 'Czech Koruna',
  DKK: 'Danish Krone',
  EUR: 'Euro',
  HKD: 'Hong Kong Dollar',
  ILS: 'Israeli New Sheqel',
  MYR: 'Malaysian Ringgit',
  MXN: 'Mexican Peso',
  NOK: 'Norwegian Krone',
  NZD: 'New Zealand Dollar',
  PHP: 'Philippine Peso',
  PLN: 'Polish Zloty',
  GBP: 'Pound Sterling',
  RUB: 'Russian Ruble',
  SGD: 'Singapore Dollar',
  SEK: 'Swedish Krona',
  CHF: 'Swiss Franc',
  THB: 'Thai Baht',
  TRY: 'Turkish Lira',
  USD: 'US Dollar'
}

export type CurrencyCode = keyof typeof CURRENCIES
