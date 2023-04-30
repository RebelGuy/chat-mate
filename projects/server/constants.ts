// see https://dev.twitch.tv/docs/authentication/scopes for available scopes.
// see https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/ to determine which scope an event subscription needs.
// see docs/twitch-auth.md for more info
// if you change the scopes here, streamers may be required to re-authorise the ChatMate Application in Studio to get access to the new events.
// you will also need to re-authenticate the ChatMate admin channel on Twitch via Studio.
export const TWITCH_SCOPE = [
  'chat:read',
  'chat:edit',
  'moderation:read',
  'moderator:manage:banned_users',

  // for modding/unmodding users
  'channel:manage:moderators',
  'channel:moderate',

  // for subscribing to follow events
  'moderator:read:followers'
]
