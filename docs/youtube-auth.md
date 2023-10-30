- Following https://github.com/googleapis/google-api-nodejs-client#oauth2-client
- Go to the developer console: https://console.cloud.google.com/apis/credentials?pli=1&project=shorts-330419
- Create a new project
- Add the Youtube Data API v3 to the project's enabled apis (https://console.cloud.google.com/apis/library?authuser=2&project=chatmate-local&supportedpurview=project)
- Create oauth consent screen
  - Configure the consent screen (only need to fill in mandatory fields)
  - Configure the scopes
    - `https://www.googleapis.com/auth/youtube`: Manage the user's YouTube account
    - `https://www.googleapis.com/auth/youtube.readonly`: View your YouTube account [not sure if necessary]
  - Add test users (accounts that can authorise the new client)
    - chat_mate_local@proton.me
    - chat_mate_prod@proton.me
    - chat_mate_sandbox@proton.me
    - chatmatetest1@gmail.com
    - chatmatetest2@gmail.com
- Create oauth client id. This identifies ChatMate Studio to google
  - Web Application
  - redirect uris: http://localhost:3000/admin/youtube and http://localhost:3000/manager
  - local:
    - client id: 419723469636-bnl40h64tppr2ag795od7ruvsispjfsu.apps.googleusercontent.com
    - client secret: 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


- it won't quite work the same because we need to explicitly generate a new oauth client for every user that is making requests, + subscribe to the token event to handle refresh token persisting.



Similar to [Twitch auth](./twitch-auth.md), we expose endpoints for authorising ChatMate to act on behalf of a user for both the admin channel and (separately) any other streamer channel. The authorisation flow is very similar to that of Twitch.

At startup, ChatMate will check that authorisation for the admin Youtube channel has been granted - if not, we enable administrative mode and authorisation must be completed as soon as possible, followed by a server restart. At the moment, we do not use the admin Youtube channel's access token for anything, but this might change in the future.

For regular streamers, requests to the API are made on behalf of the streamer for the following actions:
- Issuing bans and timeouts, and revoking them
- Getting and updating the list of mods

In addition, streamers are expected to add the ChatMate Youtube channel as a moderator to their channel. This will allow ChatMate to listen to punishment events via Masterchat, which is not possible otherwise. Upon receiving a punishment event, ChatMate will be able to synchronise a user's punishments on all connected channels, as well as their ChatMate account's rank. If authorised, the moderation status can be checked reliably via the API. If not authorised, the moderation status can be checked with limited reliability via ChatMate (this is achieved by inspecting possible actions of the latest chat item via the context menu; if a moderator-exclusive action exists, we can infer that ChatMate is a moderator of the channel).

The Youtube API quota is extremely limited (or API requests are extremely expensive). Should the API limit be reached, Masterchat could reasonably be used as a fallback, with the caveat that moderators will not be able to be added/removed, as this can only be done by the channel owner.

Youtube access tokens are valid for only 1 hour, and are automatically refreshed by Google's `OAuth2Client`. Refresh tokens are static and valid indefinitely. That is, the same refresh token can be used multiple times to generate a valid access token.
