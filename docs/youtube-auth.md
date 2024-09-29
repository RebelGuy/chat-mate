# Overview

Similar to [Twitch auth](./twitch-auth.md), we expose endpoints for authorising ChatMate to act on behalf of a user for both the admin channel and (separately) any other streamer channel. The authorisation flow is very similar to that of Twitch. Furthermore, we expose an endpoint for linking the currently logged-in user to a Youtube channel, authorised via an authorisation code.

At startup, ChatMate will check that authorisation for the admin Youtube channel has been granted - if not, we enable administrative mode and authorisation must be completed as soon as possible, followed by a server restart. At the moment, we do not use the admin Youtube channel's access token for anything, but this might change in the future.

For regular streamers, requests to the API are made on behalf of the streamer for the following actions:
- Issuing bans and timeouts, and revoking them
- Getting and updating the list of mods

In addition, streamers are expected to add the ChatMate Youtube channel as a moderator to their channel. This will allow ChatMate to listen to punishment events via Masterchat, which is not possible otherwise. Upon receiving a punishment event, ChatMate will be able to synchronise a user's punishments on all connected channels, as well as their ChatMate account's rank. If authorised, the moderation status can be checked reliably via the API. If not authorised, the moderation status can be checked with limited reliability via ChatMate (this is achieved by inspecting possible actions of the latest chat item via the context menu; if a moderator-exclusive action exists, we can infer that ChatMate is a moderator of the channel).

User authorisation occurs when a ChatMate user wishes to link their account to a Youtube channel that they own. In that case, they perform the authorisation on the frontend (ChatMate Studio) and the linking happens automatically in the backend, where the server will verify the code, retrieve the Youtube channel that authorised ChatMate, create an internal channel if required, and finally link the channel to the user. Note that the read-only permission granted by the user is revoked immediately as we do not need to keep it around.

The Youtube API quota is extremely limited (or API requests are extremely expensive). Should the API limit be reached, Masterchat could reasonably be used as a fallback, with the caveat that moderators will not be able to be added/removed, as this can only be done by the channel owner.

Youtube access tokens are valid for only 1 hour, and are automatically refreshed by Google's `OAuth2Client`. Refresh tokens are static and valid indefinitely. That is, the same refresh token can be used multiple times to generate a valid access token.

# Setting up a new Application
(This is following the instructions in and around https://github.com/googleapis/google-api-nodejs-client#oauth2-client)

1. Go to the developer console: https://console.cloud.google.com
2. Create a new project
3. Add the Youtube Data API v3 to the project's enabled apis (https://console.cloud.google.com/apis/library)
4. Create the OAuth consent screen (this is incidentally also the page we should go to later on when preparing for verification)
  - Select the External user type
  - Configure the consent screen (only need to fill in mandatory fields)
  - Configure the scopes
    - `https://www.googleapis.com/auth/youtube`: Manage the user's YouTube account
    - `https://www.googleapis.com/auth/youtube.readonly`: Probably need it for something
  - Add test users (accounts that can authorise the new client in the testing stage)
    - chat_mate_local@proton.me
    - chat_mate_prod@proton.me
    - chat_mate_sandbox@proton.me
    - chatmatetest1@gmail.com
    - chatmatetest2@gmail.com
    - rebelguysminecaft@gmail.com
- Create OAuth client ID. This identifies ChatMate to Google
  - Web Application
  - redirect URIs:
    - {chat-mate-studio}/admin/youtube
    - {chat-mate-studio}/manager
- After testing the app and ensuring everything works, publish the application on the OAuth consent screen page

## Verification
Since our OAuth app is requesting access to sensitive data, Youtube is requiring us to jump one last major hurdle before things will work. Unverified apps show a warning to the user if they attempt to complete authorisation, and includes a 100 user cap. I don't think it is required that we get this done yet, but we will need to do it at some point. It appears that the process is lengthy and complicated.
