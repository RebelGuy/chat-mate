The server is responsible for fetching data from YouTube, and (in the future) sending data to YouTube via the `Masterchat` package. It exposes this data, as well as additional functionality, via a REST API.



# Project Details

Ensure Node 16 is installed.

1. `npm install`.
2. `npm run build` to generate the a full build, including the local `Masterchat` project.
3. `npm run auth` to fetch the authentication credentials. Copy them from the console and set them in the [`.env`](#.env) file.
4. `npm run watch` while developing
5. `npm run start:debug` to run the debug server, or `npm run start:release` to run the release server

A mock server can be started using `npm run start:mock` which will automatically feed through new messages for easy client-side testing.


# .env
Define a `debug.env` and `release.env` file that sets the following environment variables, one per line, in the format `KEY=value`.

The following environment variables must be set in the `.env` file:
- `PORT`: Which port the server should run on.
- `AUTH`: The authentication credentials for the livestream user. Optional. Credentials can be obtained by running the electron app via `npm run auth`, logging into the Google account, and copying the encoded cookie token that is displayed in the console.
- `CHANNEL_ID`: The channel ID of the livestream user.
- `LIVE_ID`: The video ID of the livestream.
- `MOCK_DATA`: [Optional, debug only] The JSON file containing the `ChatSave` data that the `ChatStore` can load. If set, the server will use a mocked Masterchat to "auto-play" chat events, and no longer connect to YouTube.
- `DISABLE_SAVING`: [Optional, debug only] Whether the debug server should be run in a "read-only" mode, recommended when `MOCK_DATA` is set.

In addition, the following environment variables must be injected into the node instance using the `cross-env` package:
- `NODE_ENV`: Either `debug` or `release` to indicate whether we are running a live server or not.


# API Endpoints

Use the API endpoints to communicate with the server while it is running.


## Chat Endpoints

### `GET /chat`

Retrieves the latest chat items, sorted from earliest to latest.

Query parameters:
- `since` (number): Gets only chat items **after** the given time (unix ms).
- `limit` (number): Limits the number of returned chat items (see below).

Returns an object with the following properties:
- `schema` (1): The current schema of the return object.
- `liveId` (string): The livestream ID to which the chat items belong. Currently, this is the liveId specified in the [`.env`](#env) file.
- `lastTimestamp` (number): The timestamp of the latest chat item. Use this value as the `since` query parameter in the next request for continuous data flow.
- `isPartial` (boolean): Whether the chat items returned in this request represent only a subset of the total chat data we have. If no query parameters are provided, this will always return be `true`.
- `chat` ([ChatItem](#ChatItem)[]): The chat data that satisfy the request filter.



# Data Types


## ChatItem
- `internalId` (number): Currently unused.
- `id` (string): YouTube's ID.
- `timestamp` (number): Unix timestamp in milliseconds.
- `author` ([Author](#Author)): The author of the chat item.
- `messageParts` ([PartialChatMessage](#PartialChatMessage)): The partial messages that make up the contents of this chat item.
- `renderedText` (string): The message conversion to pure text. Note that information about emojis or other special items may be lost.

## Author
- `internalId` (number): Currently unused.
- `name` (string): The author name (channel name).
- `channelId` (string): The unique YouTube channel ID.
- `image` (string): The image URL of the author's channel.
- `attributes` ([AuthorAttributes](#AuthorAttributes)): Flags relating to the author's status in regards to the livestream.

## AuthorAttributes
- `isOwner` (boolean): Whether the user is the channel owner of the livestreamer's channel.
- `isModerator` (boolean): Whether the user is a moderator on the livestream.
- `isVerified` (boolean): Whether the user has a YouTube verified checkmark.

## PartialChatMessage
- `type` (string): The type of partial message.
  - `text`: The message part consists purely of text.
  - `emoji`: The message part consists purely of a single emoji.
- `text` (string): The text of a message part of type `text`.
- `isBold` (boolean): Whether the text of a message of type `text` is bold.
- `isItalics` (boolean): Whether the text of a message of type `text` is in italics.
- `name` (string): The emoji name, only for a message part of type `emoji`. It is the same name that is shown when hovering over the emoji.
- `label` (string): The emoji label, only for a message part of type `emoji`. It is either the shortcut text (e.g. `:yt:`, or the first search term used for this emoji).
- `image` ([ChatImage](#ChatImage)): The image representing the emoji, only for a message part of type `emoji`.

## ChatImage
- `url` (string): The image URL for the emoji.
- `width` (number): The pixel width of the emoji image.
- `height` (number): The pixel height of the emoji image.



# Change Log

## v1.1
- Added docs
- LiveId can now be any YouTube link to the livestream
- Fixed error handling

## v1.0
- Initial release
- Simple fetching and saving of chat messages
- Added `GET /chat` endpoint
