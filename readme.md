At the moment, the main project in `chat-mate` is `./projects/server`. It communicates with YouTube, the Minecraft client, and the database.

To get things running, ensure Node 16 is installed, and a global version of yarn exists (`npm install --global yarn`). If running `yarn --version` fails, run PowerShell as an administrator and execute the command `Set-ExecutionPolicy Unrestricted`. Note that packages should be added using `yarn add <packageName> [--dev]` **in their respective workspace**.

Recommended extensions:
- `ESLint`
- `GitLens`
- `Prisma`

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
