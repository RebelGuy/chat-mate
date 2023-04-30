ChatMate authenticates via an OAuth2 Application on Twitch. There are two forms of authentication required for ChatMate to function properly:
- Admin authentication: allows the Server to join streamers' chat rooms using the ChatMate admin Twitch channel.
- Streamer authentication: allows the Server to listen to the streamers' events and perform moderation actions on the streamer's behalf.

# Authentication by an admin
For some actions, such as joining chat rooms, the ChatMate Server Application acts on behalf of the ChatMate Twitch account. To make this possible, the Twitch account must first authorise the Application to perform these actions. The `/admin/twitch` Studio page contains instructions and provides a button for refreshing the authorisation. Please ensure you authorise only using the Twitch channel stated on that page - else, things won't work properly. A server restart is required for changes to come into effect.

Generally, the admin authorisation is only required when ChatMate is in administrative mode (for example, if the scopes have changed or the access token has expired).

The authentication flow works as follows:

1. The ChatMate admin user navigates to the `/admin/twitch` page on Studio
2. Studio asks the Server for a Twitch login URL and presents it to the user
3. The user navigates to the URL and enters their Twitch login details
4. Twitch redirects back to Studio with an authorisation `code`
5. Studio relays the `code` to the Server
6. The Server sends an authentication request to Twitch and retrieves the `access_token`
7. The Server saves the `access_token` to the database to be used in the next initialisation phase
8. Studio can display a success message

Importantly, the above generates a **user access token** that we persist and refresh over time. It gives us permission to act on behalf of the ChatMate Twitch channel.

# Authentication by a streamer
For other actions, such as subscribing to events via the EventSub API or performing moderation actions, the ChatMate Server acts on behalf of the streamer. It requires explicit authorisation from the streamer.

The authorisation flow is the same as for the admin authorisation outlined above, except it is performed via the `/manager` page on Studio.

Once authrosation is granted, ChatMate will automatically re-attempt subscribing to the streamer's failed events. Whenever requests for the streamer's data are made using the TwurpleClient, the streamer's saved access token will be loaded into memory (if it doesn't exist already) and used under the hood by the client to is requests.

Authorisation is required by any new streamers, and whenever the scopes have changed. Note that, in the case of changed scopes, everything _may_ continue to work correctly for the streamer - 
