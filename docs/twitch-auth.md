ChatMate authenticates via an OAuth2 Application on Twitch. There are two forms of authentication required for ChatMate to function properly:
- Admin authentication: allows the Server to join streamers' chat rooms and perform moderation operations.
- Streamer authentication: allows the Server to listen to the streamers' events.

# Authentication by an admin
For some actions, such as joining chat rooms and performing moderation operations, the ChatMate Server Application acts on behalf of the corresponding ChatMate Twitch account. To make this possible, the Twitch account must first authorise the Application to perform these actions. The `/admin/twitch` Studio page contains instructions and provides a button for refreshing the authorisation. Please ensure you authorise only using the Twitch channel state on that page - else, things won't work properly. A server restart is required for changes to come into effect.

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
For other actions, such as subscribing to events via the EventSub API, the ChatMate Server acts as its own entity (not on behalf of the user). Without explicit authorisation from the streamer, some event subscriptions will fail.

The authentication flow works as follows:
1. Todo
last. ChatMate will automatically re-attempt subscribing to those of the streamer's events that failed to create due to a 403 error code.

Importantly, the above generates an **app access token** that we discard, as it is stored by Twitch internally for bookkeeping. We simply have to provide our application's Client ID and Secret for authentication when subscribing to a streamer's events, and Twitch will check their records to verify that the user has given our Application access to subscribe to these events.

From [this article](https://barrycarlyon.co.uk/wordpress/2021/02/03/how-does-twitchs-new-eventsub-work/):
```
[W]hen you make a subscription request to EventSub, Twitch looks at your App Access token, then checks in the background if the requested broadcaster has connected to your Application at any point, with the relevant scopes, and not revoked that connection.
```

The streamer authorisation is required by any new streamers, and whenever the scopes have changed.

