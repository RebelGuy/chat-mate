The server is responsible for fetching data from Youtube via the `masterchat` project, and from Twitch via the `@twurple` package. It exposes this chat data, as well as additional functionality, via a REST API.



# Project Details
Debug and release environments both have their own folders in `./data` and `./dist` to ensure that ongoing development does not interfere with the ability to run release versions.

Note: If fetching Youtube metadata incurs a "Rate limit exceeded" error, then Youtube has flagged us as a bot. A (temporary?) solution is to regenerate an auth token (see below).

Twitch's EventSub notifies us of new events. To set up the listener on our local machine, we use `ngrok` (https://ngrok.com/download). See https://twurple.js.org/docs/getting-data/eventsub/listener-setup.html for more details.

Note: Importing modules from Twurple must be done from the package level, `@twurple/<package-name>`, rather than `@twurple/<package-name>/lib` (unfortunately VSCode defaults to this type of importing, which will result in a runtime error). 


## Scripts for development:
1. `yarn install`.
2. `yarn auth` to fetch the authentication credentials for YouTube, and `yarn auth:twitch:<debug|release>`. Copy them from the console and set them in the [`.env`](#.env) file.
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
- `TWITCH_CLIENT_ID`: The client ID for twitch auth (from https://dev.twitch.tv/console/apps).
- `TWITCH_CLIENT_SECRET`: The client secret for twitch auth.
- `TWITCH_ACCESS_TOKEN`: The access token retrieved from `yarn auth:twitch:debug` or `yarn auth:twitch:release`. This is required only when running the server for the first time, or when prompted.
- `TWITCH_REFRESH_TOKEN`: The refresh token retrieved from `yarn auth:twitch:debug` or `yarn auth:twitch:release`. This is required only when running the server for the first time, or when prompted.
- `TWITCH_CHANNEL_NAME`: The Twitch channel's name to which we should connect.
- `DATABASE_URL`: The connection string to the MySQL database that Prisma should use. **Please ensure you append `?pool_timeout=30&connect_timeout=30` to the connection string (after the database name)** to prevent timeouts during busy times. More options can be found at https://www.prisma.io/docs/concepts/database-connectors/mysql
- `IS_MOCK_LIVESTREAM`: [Optional, debug only] If true, uses the chat data of the `LIVE_ID` to replay its chat events, and no longer connect to YouTube. See `MockMasterchat` for more options, such as hardcoding the set of messages to send, or taking console user input for specifying the next message text.
- `USE_FAKE_CONTROLLERS`: [Optional, debug only] If true, replaces some controllers with test-only implementations that generate fake data. This also disables communication with external APIs (that is, it is run entirely offline).

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
`yarn test` performs the test suite.
`yarn test:db` Sets up the test database.
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
- 🟢 ChannelService
  - 🟢 getActiveUserChannel
  - 🟢 getActiveUserChannels
  - 🟢 getUserByChannelName
  - 🟢 getUserById
- 🟢 ChatService
  - 🟢 onNewChatItem
- 🟢 ChatFetchService
  - 🟢 initialise
- 🟢 EmojiService
  - 🟢 applyCustomEmojis
- 🟢 ExperienceService
  - 🟢 addExperienceForChat
  - 🟢 getLeaderboard
  - 🟢 getLevel
  - 🟢 getLevelDiffs
  - 🟢 modifyExperience
- 🟢 LivestreamService
  - 🟢 initialise
- 🟢 MasterchatProxyService
  - 🟢 fetch
  - 🟢 fetchMetadata
- 🟢 StatusService
  - 🟢 getApiStatus
  - 🟢 onRequestDone
- 🟢 TwurpleApiProxyService
  - 🟢 fetchMetadata
- 🟢 TwurpleService
  - 🟢 initialise
- ⚪ FileService
- ⚪ LogService

**Stores**
- 🟢 AuthStore
  - 🟢 loadAccessToken
  - 🟢 saveAccessToken
- 🟢 ChannelStore
  - 🟢 createOrUpdate
  - 🟢 getCurrentUserIds
  - 🟢 getCurrentUserNames
  - 🟢 getUserId
- 🟢 ChatStore
  - 🟢 addChat
  - 🟢 getChatSince
  - 🟢 getLastChatByUser
- 🟢 CustomEmojiStore
  - 🟢 addCustomEmoji
  - 🟢 getAllCustomEmojis
  - 🟢 updateCustomEmoji
- 🟢 ExperienceStore
  - 🟢 addChatExperience
  - 🟢 addManualExperience
  - 🟢 getSnapshot
  - 🟢 getPreviousChatExperience
  - 🟢 getAllTransactionsStartingAt
  - 🟢 getTotalDeltaStartingAt
- 🟢 FollowerStore
  - 🟢 getFollowersSince
  - 🟢 saveNewFollower
- 🟢 LivestreamStore
  - 🟢 initialise
  - 🟢 currentLivestream
  - 🟢 setContinuationToken
  - 🟢 setTimes
- 🟢 ViewershipStore
  - 🟢 addLiveViewCount
  - 🟢 addViewershipForChatParticipation
  - 🟢 getLastSeen
  - 🟢 getLatestLiveCount
  - 🟢 getLivestreamParticipation
  - 🟢 getLivestreamViewership

**Providers**
- 🟢 TwurpleAuthProvider
  - 🟢 initialise

**Helpers**
- 🟢 ExperienceHelpers
  - 🟢 calculateChatMessageQuality
  - 🟢 calculateExperience
  - 🟢 calculateLevel
  - 🟢 calculateParticipationMultiplier
  - 🟢 calculateQualityMultiplier
  - 🟢 calculateRepetitionPenalty
  - 🟢 calculateSpamMultiplier
  - 🟢 calculateViewershipMultiplier
- 🟢 TimerHelpers
  - 🟢 createRepeatingTimer
  - 🟢 dispose

**Misc**
- 🔴 util/math
- 🔴 util/score


# API Endpoints

Use the API endpoints to communicate with the server while it is running. The API base URL is `http://localhost:3010/api`.

A response contains the following properties:
- `schema` (`number`): The current schema of the return object. Every time there is a change, this will be bumped up by one to avoid inconsistencies between the server and client.
- `timestamp` (`number`): The unix timestamp (in ms) at which the response was generated.
- `success` (`boolean`): True if the request was processed correctly, and false otherwise.
- `data` (`object`): Only included if `success` is `true`. Contains the response data, outlined for each endpoint below.
- `error` (`object`): Only included if `success` is `false`. Contains the following properties:
  - `errorCode` (`number`): The HTTP error code that most closely matches the type of problem encountered.
  - `errorType` (`string`): The general type of error encounterd.
  - `message` (`string`): An optional error message describing what went wrong.

Note that a `500` error can be expected for all endpoints, but any other errors should be documented specifically in the below sections.

All non-primitive properties of `data` are of type `PublicObject`, which are reusable, schema-tagged objects which themselves contain either primitive types or other `PublicObject`s. The schema definitions for these can be found in the `./controllers/public` folder and will not be reproduced here. Please ensure the client's model is in sync at all times. The schema of an object should be bumped whenever a property of this object, or one of its children changes. That is, schema changes should cascade upwards until reaching the controller levels.

Any data in the request body should also have a schema. This is always in sync with the schema version of the response object.

## Chat Endpoints
Path: `/chat`.

### `GET`
*Current schema: 6.*

Retrieves the latest chat items.

Query parameters:
- `since` (`number`): *Optional.* Gets only chat items **after** the given time (unix ms).
- `limit` (`number`): *Optional.* Limits the number of returned chat items. Defaults to 100.

Returns data with the following properties:
- `reusableTimestamp` (`number`): The timestamp of the latest chat item. Use this value as the `since` query parameter in the next request for continuous data flow (no duplicates).
- `chat` (`PublicChatItem[]`): The chat data that satisfy the request filter, sorted in ascending order by time.

## ChatMate Endpoints
Path: `/chatMate`.

### `GET /status`
*Current schema: 2.*

Gets the latest status information.

Returns data with the following properties:
- `livestreamStatus` (`PublicLivestreamStatus`): Status information relating to the current livestream.
- `youtubeApiStatus` (`PublicApiStatus`): Status information relating to the YouTube API.
- `twitchApiStatus` (`PublicApiStatus`): Status information relating to the YouTube API.

### `GET /events`
*Current schema: 3.*

Gets the events that have occurred since the specified time.

Query parameters:
- `since` (`number`): *Required.* Gets only events **after** the given time (unix ms).

Returns an data with the following properties:
- `reusableTimestamp` (`number`): Use this value as the `since` query parameter in the next request for continuous data flow (no duplicates).
- `events` (`PublicChatMateEvent[]`): The list of events that have occurred since the given timestamp.

Can return the following errors:
- `400`: When the required query parameters have not been provided.

## Emoji Endpoints
Path: `/emoji`.

### `GET /custom`
*Current schema: 1.*

Gets all custom emojis.

Returns data with the following properties:
- `emojis` (`PublicCustomEmoji[]`): The list of all custom emojis.

### `POST /custom`
*Current schema: 1.*

Add a new custom emoji.

Request data (body):
- `newEmoji` (`PublicCustomEmojiNew`): *Required.* The new emoji's data. Note that the `symbol` must be unique, otherwise the request will get rejected.

Returns data with the following properties:
- `newEmoji` (`PublicCustomEmoji`): The new emoji that was created.

Can return the following errors:
- `400`: When the request data is not sent, or is formatted incorrectly.

### `PATCH /custom`
*Current schema: 1.*

Update an existing custom emoji.

Request data (body):
- `updatedEmoji` (`PublicCustomEmoji`): *Required.* The updated emoji's data. Note that the `symbol` must be unique, otherwise the request will get rejected. The `id` is used to match the new emoji to an emoji in the database.

Returns data with the following properties:
- `updatedEmoji` (`PublicCustomEmoji`): The updated emoji data.

Can return the following errors:
- `400`: When the request data is not sent, or is formatted incorrectly.

## Experience Endpoints
Path: `/experience`.

### `GET /leaderboard`
*Current schema: 2.*

Gets the ranked experience list of all users.

Returns data with the following properties:
- `rankedUsers` (`PublicRankedUser[]`): The array of every user's rank, sorted in ascending order.

### `GET /rank`
*Current schema: 2.*

Gets the rank of a specific user, as well as some context. Essentially, it returns a sub-section of the data from `GET /leaderboard`.

Query parameters:
- `id` (`number`): *Required.* The id of the user for which the rank is to be returned.

Returns data with the following properties:
- `relevantIndex` (`number`): The index of the entry in `entries` that belongs to the matched channel. Never negative.
- `rankedUsers` (`PublicRankedUser[]`): The partial leaderboard in ascending order, which includes the matched channel. Never empty.

Can return the following errors:
- `400`: When the required query parameters have not been provided.
- `404`: When no channel could be matched against the search query.

### `POST /modify`
*Current schema: 1.*

Modifies a player's experience by adding a special admin transaction.

Request data (body):
- `userId` (`int`): *Required.* The user whose experience should be modified.
- `deltaLevels` (`float`): *Required.* How many levels to add or take away. This can be a fractional value. A user's current fractional level is given by `levelInfo.level + levelInfo.levelProgress`.
  message: (`string`): *Optional.* A custom message to add as part of the transaction.

Returns data with the following properties:
- `updatedUser` (`PublicUser`): The user object after the experience change has been applied.

Can return the following errors:
- `400`: When the request data is not sent, or is formatted incorrectly.
- `404`: When the given user is not found.

## User Endpoints
Path: `/user`.

### `POST /search`
*Current schema: 2.*

Search for a specific user.

Request data (body):
- `searchTerm` (`string`): *Required.* The string to search in user's channel names.

Returns data with the following properties:
- `results` (`PublicUserNames[]`): An array containing the users with matching channel names. If no match was found, the array is empty. Users are sorted in ascending order according to the match quality, with the first user having the best match.

Can return the following errors:
- `400`: When the request data is not sent, or is formatted incorrectly.
