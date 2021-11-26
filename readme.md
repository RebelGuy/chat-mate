The server is responsible for fetching data from YouTube, and (in the future) sending data to YouTube via the `Masterchat` package. It exposes this data, as well as additional functionality, via a REST API.



# Project Details

To start off, you must first obtain credentials using `npm run auth` and set them in the [`.env`](#.env) file.

If running the `Masterchat` package locally, ensure it is built by doing `npm run build:dependencies`.

To generate a complete build, use `npm run build`, or to generate only a build of the project, use `npm run build:project`.

To build the project and watch for changes, use `npm run watch`.

To start the server, use `npm run start`.



# .env
The following environment variables can be set in the `.env` file:
- `PORT`: Which port the server should run on.
- `AUTH`: The authentication credentials for the livestream user. Optional. Credentials can be obtained by running the electron app via `npm run auth`, logging into the Google account, and copying the encoded cookie token that is displayed in the console.
- `CHANNEL_ID`: The channel ID of the livestream user.
- `LIVE_ID`: The video ID of the livestream.



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
