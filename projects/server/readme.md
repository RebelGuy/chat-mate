The server is responsible for fetching data from YouTube, and (in the future) sending data to YouTube via the `masterchat` project. It exposes this chat data, as well as additional functionality, via a REST API.



# Project Details
Debug and release environments both have their own folders in `./data` and `./dist` to ensure that ongoing development does not interfere with the ability to run release versions.


## Scripts for development:
1. `yarn install`.
2. `yarn auth` to fetch the authentication credentials. Copy them from the console and set them in the [`.env`](#.env) file.
3. `yarn watch` while developing
4. `yarn start:debug` to run the debug server, or `yarn start:mock` to run a mock server that will automatically feed through new messages for easy client-side testing - see `MockMasterchat` for more info and options. Note that this does not bundle up the application. For a debug bundle that mirrors the release build, use `yarn build:debug`.

Alternatively, run `yarn build:debug` to bundle the debug app to the same format as what is used in release.
If building fails because the Prisma client could not be found, please run `yarn generate`.

## Scripts for production:
Assumes that steps 1-3 of the previous section have been run.
3. `yarn build:release` bundles the application as `./dist/release/server/app.js`.
4. `yarn migrate:release` migrate the database to the latest schema
5. `yarn start:release` to run the release server


# .env
Define a `debug.env` and `release.env` file that sets the following environment variables, one per line, in the format `KEY=value`. The `template.env` file can be used as a template.

The following environment variables must be set in the `.env` file:
- `PORT`: Which port the server should run on.
- `AUTH`: The authentication credentials for the livestream user. Optional. Credentials can be obtained by running the electron app via `yarn auth`, logging into the Google account, and copying the encoded cookie token that is displayed in the console.
- `CHANNEL_ID`: The channel ID of the livestream user.
- `LIVE_ID`: The video ID of the livestream.
- `DATABASE_URL`: The connection string to the MySQL database that Prisma should use.
- `IS_MOCK_LIVESTREAM`: [Optional, debug only] If true, uses the chat data of the `LIVE_ID` to replay its chat events, and no longer connect to YouTube. See `MockMasterchat` for more options, such as hardcoding the set of messages to send, or taking console user input for specifying the next message text.

In addition, the following environment variables must be injected into the node instance using the `cross-env` package:
- `NODE_ENV`: Either `debug` or `release` to indicate whether we are running a live server or not.
- `BUILD`: Either `tsc` or `webpack` to indicate the build method. This is used for some module resolution workarounds at runtime.

For testing, define a `test.env` file that sets only a subset of the above variables:
- `DATABASE_URL`

## Database

The `debug` MySQL database is named `chat_mate_debug`, while the `release` database is named `chat_mate`, and the `test` database is named `chat_mate_test`. Ensure the `DATABASE_URL` connection string is set in the respective [`.env`](#.env) file.

`Prisma` is used as both the ORM and typesafe interface to manage communications with the underlying MySQL database. Run `yarn migrate:debug` to sync the local DB with the checked-out migrations and generate an up-to-date Prisma Client.

At any point where the prisma file (`prisma.schema` - the database schema) is modified, `yarn generate` can be run to immediately regenerate the Prisma Client for up-to-date typings. This should also be run if the project structure changes in some way. No actual database changes are performed as part of this command. For more help and examples with using the Prisma Client and querying, see https://www.prisma.io/docs/concepts/components/prisma-client.

Run `yarn migrate:schema` to generate a new `migration.sql` file for updating the MySQL database, which will automatically be opened for editing. Note that while this migration is not applied, any earlier unapplied migrations will be executed prior to generating the new migration. All outstanding migrations can be applied explicitly, and a new Prisma Client generated, using `yarn migrate:debug`.

During a migration, ensure that the `.sql` is checked and edited to avoid data loss, but avoid making manual changes that affect the database schema, other than the ones already present.

`yarn migrate:release` deploys changes to the production environment. Only uses migration files, NOT the Prisma schema file.


## Testing
`yarn test` performs the test suite, including setting up and utilising the test database and schema.
`yarn test:dev` performs the test suite without checking the database schema first.
`yarn test <file regex>` includes only tests within files matching the expression.

Further, to filter individual tests, temporarily replace `test()` with `test.only()`. All `test()`s will then be skipped.

Due to concurrency issues, all tests using the test database will need to be run from the central `_test/stores.test.ts` file. It imports the `<StoreName>.suite.ts` files which contain the actual test, then run them one-by-one.

### Current test coverage
Over time, aim to add tests to all public methods of all services and stores.
Key:
- 🔴: No tests
- 🟡: In progress/incomplete tests
- 🟢: Full test coverage
- ⚪: Won't do

**Services**
- 🟢 ChatService 
- ⚪ FileService
- ⚪ LogService

**Stores**
- 🟢 ChannelStore
  - 🟢 createOrUpdate
  - 🟢 exists
  - 🟢 getCurrent
  - 🟢 getHistory
- 🟢 ChatStore
  - 🟢 addChat
  - 🟢 getChatSince
  - 🟢 getContinuationToken
- 🟢 LivestreamStore
  - 🟢 createLivestream
  - 🟢 currentLivestream
  - 🟢 setContinuationToken

# API Endpoints

Use the API endpoints to communicate with the server while it is running.


## Chat Endpoints

### `GET /chat`

Retrieves the latest chat items, sorted from earliest to latest.

Query parameters:
- `since` (number): Gets only chat items **after** the given time (unix ms).
- `limit` (number): Limits the number of returned chat items (see below).

Returns an object with the following properties:
- `schema` (`3`): The current schema of the return object.
- `liveId` (`string`): The livestream ID to which the chat items belong. Currently, this is the liveId specified in the [`.env`](#env) file.
- `lastTimestamp` (`number`): The timestamp of the latest chat item. Use this value as the `since` query parameter in the next request for continuous data flow (no duplicates).
- `chat` ([`ChatItem`](#ChatItem)[]): The chat data that satisfy the request filter.



# Data Types


## ChatItem
- `internalId` (`number`): ChatMate database ID.
- `id` (`string`): YouTube's ID.
- `timestamp` (`number`): Unix timestamp in milliseconds.
- `author` ([`Author`](#Author)): The author of the chat item.
- `messageParts` ([`PartialChatMessage`](#PartialChatMessage)): The partial messages that make up the contents of this chat item.

## Author
- `internalId` (`number`): ChatMate database ID.
- `name` (`string?`): The author name (channel name).
- `channelId` (`string`): The unique YouTube channel ID.
- `image` (`string`): The image URL of the author's channel.
- `isOwner` (`boolean`): Whether the user is the channel owner of the livestreamer's channel.
- `isModerator` (`boolean`): Whether the user is a moderator on the livestream.
- `isVerified` (`boolean`): Whether the user has a YouTube verified checkmark.
- `lastUpdate` (`number`): Timestamp of the last time the author's info was updated.

## PartialChatMessage
- `type` (`string`): The type of partial message.
  - `text` (`string`): The message part consists purely of text.
  - `emoji` (`string`): The message part consists purely of a single emoji.
- `text` (`string`): The text of a message part of type `text`.
- `isBold` (`boolean`): Whether the text of a message of type `text` is bold.
- `isItalics` (`boolean`): Whether the text of a message of type `text` is in italics.
- `emojiId` (`string`): A unique ID for this emoji.
- `name` (`string`): The emoji name, only for a message part of type `emoji`. It is the same name that is shown when hovering over the emoji.
- `label` (`string`): The emoji label, only for a message part of type `emoji`. It is either the shortcut text (e.g. `:yt:`, or the first search term used for this emoji).
- `image` ([`ChatImage`](#ChatImage)): The image representing the emoji, only for a message part of type `emoji`.

## ChatImage
- `url` (`string`): The image URL for the emoji.
- `width` (`number?`): The pixel width of the emoji image.
- `height` (`number?`): The pixel height of the emoji image.