At the moment, the main project in `chat-mate` is `./projects/server`. It communicates with YouTube, the Minecraft client, and the database.

A work-in-progress is the `./projects/studio` project. It is a (for now) private web interface to manage some data within the database. It communicates with the server endpoints.

To get things running, ensure Node 16 is installed, and a global version of yarn exists (`npm install --global yarn`). If running `yarn --version` fails, run PowerShell as an administrator and execute the command `Set-ExecutionPolicy Unrestricted`. Note that packages should be added using `yarn add <packageName> [--dev]` **in their respective workspace**.

Recommended VSCode extensions:
- `ESLint`
- `GitLens`
- `Prisma`
- `GitHub Actions`

## Quick livestream setup
Follow these steps to set up a new livestream. This assumes the latest `chat-mate-client` version is already built and added to the Minecraft /mods folder.
- Set up the livestream on YouTube (e.g. via scheduling) and get its link or ID
- Set the ID to the `LIVE_ID` variable in the `release.env` file
- Ensure the database is running by starting up Workbench and closing it again
- `yarn install`
- `yarn workspace server migrate:release` to get the database up-to-date
- `yarn workspace server build:release` to transpile and bundle up the application
- `yarn workspace server start:release` in a console window during the livestream
- Once done, CTRL+C or close the console window

## Adding the `masterchat` Subtree link

By default, the `masterchat` subtree link is not shown in Sourcetree when cloning the project to a fresh folder.
A manual fix is to add the following property to the JSON object in `.git/sourcetreeconfig.json`:
```JSON
"SubtreeLinks": [
  {
    "$id": "386",
    "SourcePathUrl": "https://github.com/holodata/masterchat.git",
    "Prefix": "projects/masterchat",
    "Refspec": "master"
  }
]
```

# Change Log
## v1.13 - The Punishment Update [30/5/2022]
- Server
  - Added ability to apply punishments to livestream participants
    - Ban: user's channels are banned on YouTube/Twitch
    - Timeout: user's channels are timed out on YouTube/Twitch
      - On YouTube, timeouts can only be issued in blocks of 5 minutes, but we can simulate longer timeouts by automatically reapplying the punishment
    - Mute: user's messages are hidden in the client (internal punishment)
    - Users with an active punishment will not receive any experience
  - Punishments can have a custom reason attached, and can be revoked with another message
  - New Twitch followers are now saved to the DB
- Masterchat
  - Fixed context actions not working
  - Pulled in v0.15.0

## v1.12 - The Twitch Update [1/4/2022]
- Server
  - Added Twitch as a chat provider
    - Initial authentication is achieved via an Electron app
    - Twurple is used to communicate with the Twitch API
    - Event-based chat system conforms messages to a known format and forwards them to ChatService
    - Helix API is used for fetching stream metadata
    - Database key mappings are now defined explicitly to aid in future renaming tasks
  - Individual participants are now represented by a `User`
    - Can have a Youtube or Twitch Channel linked, or both
  - Fixed negative experience bug
  - Fixed wheelchair emoji

## v1.11 - The Modal Update [20/3/2022]
- Server
  - Bug fixes

## v1.10 - The Emoji Update [5/3/2022]
- Server
  - Added Custom Emojis
    - Given a chat item, can replace text or emoji parts with a custom emoji part
    - Current eligibility is based only on level
  - Added Fake Controllers for testing
  - Increased the experience difficulty past level 50, and added penalty for spamming the same message
  - Small bug fixes and code improvements
- Studio
  - Initialised project
  - Added page for visually managing the custom emojis

## v1.9 - The Pre-Admin Update [20/2/2022]
- Server
  - Endpoint changes
    - Added a PoST /experience/modify endpoint to modify a user's experience
      - This adds a custom admin transaction with optional message
    - Added a POST /user/search endpoint to search for a channel by name
      - Returns a list of matches
    - The GET /leaderboard/rank endpoint now accepts a user by id
  - API data now uses Public Objects
    - Standardised and reusable
    - Schema-tagged
    - Simple serialisable objects
  - Snapshots are now maintained manually
  - Bug fixes and better error handling

## v1.8 - The Housekeeping Update [12/2/2022]
- Server
  - Added a new `/experience` endpoint
    - `GET /leaderboard` returns the complete experience leaderboard
    - `GET /rank` returns a partial leaderboard, highlighting a specific channel
  - Improved the context provider - it now automatically initialises and disposes its classes
  - Fixed many caching issues and a database connection issue

## v1.7 - The Dashboard Update v2 [5/2/2022]
- Server
  - Added a new `GET /event` endpoint
    - At the moment, returns level-up events since the given time
  - Migrated to ESLint

## v1.6 - The Dashboard Update [28/1/2022]
- Server
  - Added status endpoint
  - Live viewer counts are now tracked
  - Improved testability of services involving timers
- Masterchat
  - Now returns live viewer counts

## v1.5 - The Experience Update [8/1/2022]
- Server
  - Added levelling - viewers gain levels by participating in the chat
  - Added viewership tracking, which can only be approximated at this point
  - Added livestream metadata tracking
  - The GET /chat endpoint now returns information about an author's current level
- Masterchat
  - Now fetches livestream metadata

## v1.4 - The Test Update [30/12/2021]
- Server
  - Added yarn workspaces and webpack bundling
  - Added unit/integration tests
- Masterchat
  - Added to chat-mate repository

## v1.3 - The Database Update [16/12/2021]
- Server
  - Added Prisma and MySQL database
  - Added database migration scripts
  - Fixed Webpack bundling
  - Updated ChatController return model

## v1.2 - The Development Update [8/12/2021]
- Server
  - Added separate debug/release environments (.env file, /data folder, and build output)
  - Added `MockMasterchat` for more convenient testing
  - Added `LogService`
  - Project now uses yarn

## v1.1 - The Encoding Update [26/11/2021]
- Server
  - Added docs
  - LiveId can now be any YouTube link to the livestream
  - Fixed error handling

## v1.0 [20/11/2021]
- Server
  - Initial release
  - Simple fetching and saving of chat messages
  - Added `GET /chat` endpoint
