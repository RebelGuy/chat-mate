ChatMate authenticates via an OAuth2 Application on Twitch. The Application owner (Rebel_Guy) is exclusively responsible for refreshing the access token if required, for example, if any of the scopes have changed.

The authentication flow has recently been integrated into Studio and works as follows:

1. The user (Application owner) navigates to the Twitch authentication page on Studio
2. Studio asks the Server for a Twitch login URL and presents it to the user
3. The user navigates to the URL and enters their Twitch login details
4. Twitch redirects back to Studio with an authorisation `code`
5. Studio relays the `code` to the Server
6. The Server sends an authentication request to Twitch and retrieves the `access_token`
7. The Server saves the `access_token` to the database
8. Studio can display a success message
