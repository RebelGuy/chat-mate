At the moment, the main project in `chat-mate` is `./projects/server`. It communicates with YouTube, the Minecraft client, and the database.

A work-in-progress is the `./projects/studio` project. It is a web interface to manage some data within the database and view account information. It communicates with the server endpoints.

To get things running, ensure Node 18 is installed* (recommend [nvm](https://github.com/nvm-sh/nvm), and a global version of yarn exists (`npm install --global yarn`). If running `yarn --version` fails, run PowerShell as an administrator and execute the command `Set-ExecutionPolicy Unrestricted`. Note that packages should be added using `yarn add <packageName> [--dev]` **in their respective workspace**.

*If updating the Node version, please make sure to also update the Azure environment.

Ensure the VSCode Typescript version is the same as the one used in the workspace to avoid getting "Type instantiation is excessively deep and possibly infinite" errors all over the place.

Recommended VSCode extensions:
- `ESLint`
- `GitLens`
- `Prisma`
- `GitHub Actions`
- `Thunder Client`

## CI and deployment
Github Actions is used for automatically building and deploying the Server/Studio projects when pushed.

Pushing to any branch will trigger the build process. Pushing to `master` or `develop` will also trigger automatic deployment to the production or sandbox environments, respectively, unless the string `--skip-deploy` is contained in the commit message.

Deployment of the Server includes an automatic migration of the database.

## Quick livestream setup
Follow these steps to set up a new livestream. This assumes the latest `chat-mate-client` version is already built and added to the Minecraft /mods folder.
- Set up the livestream on YouTube (e.g. via scheduling) and get its link or ID
- ~~Set the ID to the `LIVE_ID` variable in the `release.env` file~~
- ~~Ensure the database is running by starting up Workbench and closing it again~~
- ~~`yarn install`~~
- ~~`yarn workspace server migrate:release` to get the database up-to-date~~
- ~~`yarn workspace server build:release` to transpile and bundle up the application~~
- ~~`yarn workspace server start:release` in a console window during the livestream~~
- ~~Once done, CTRL+C or close the console window~~
- Set the livestream ID either via the Client's dashboard page, or via the Studio form

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

## ChatMate admin channels

External ChatMate channels are used to join streamers' chat rooms, listen for data, and perform moderation actions. They are linked to the registered user with username `chatmate`.

| Environment | Email | YouTube Name* | YouTube Channel ID | Twitch Name | Twitch App Name | Twitch App Client ID |
| --- | --- | --- | --- | --- | --- | --- |
| Local | chat_mate_local@proton.me | [Chat M8 Local](https://www.youtube.com/channel/UCobq78RdXWvXlG1jcRjkTig) | UCobq78RdXWvXlG1jcRjkTig | [chat_mate_local](https://www.twitch.tv/chat_mate_local) | chat_mate_local | ffgmiebh7yve5mq6tgbvvgj4kbl0cn |
| Sandbox | chat_mate_sandbox@proton.me | [Chat M8 Sandbox](https://www.youtube.com/channel/UCEM2zbU-YVO6BMF_fukrdUA) | UCEM2zbU-YVO6BMF_fukrdUA | [chat_mate_sandbox](https://www.twitch.tv/chat_mate_sandbox) | chat_mate_sandbox | k6aeajd6dwopc9whkz9s5z56h3f1es |
| Production | chat_mate_prod@proton.me | [Chat M8](https://www.youtube.com/channel/UCY-5SHtJqoKGqm2YmOMOm_g) | 5SHtJqoKGqm2YmOMOm_g | [chat_mate](https://www.twitch.tv/chat_mate) | chat_mate | c20n7hpbuhwcaqjx9424xoy63765wg |

*YouTube appears to be prohibiting the word "mate" in the channel name.

Passwords:
- Email: `P`
- Twitch: `T`
- YouTube: `C`

# Change Log
## v1.24 - The Studio Update [5/4/2023]
- Server
  - Added the ability to query the status of a command
  - Added endpoints for authenticating the ChatMate Twitch Application externally, instead of using the local scripts
  - Bug fixes
- Studio
  - Major redesign of the entire project
    - Uses Material UI frontend
    - Better navigation and streamer selection
    - Improved overall user experience
    - Better user instructions for how linking works
  - Major refactoring of the entire project
    - Studio now uses React Router
      - e.g. `/<streamer>/emojis` automatically selects the specified streamer and shows their emojis
    - Added developer-friendly hooks
    - Converted class-based components to functional components
  - The ChatMate Twitch Application can now be authenticated from within Studio
- Masterchat
  - Logging is now saved alongside server logs (previously, Masterchat logs were not saved anywhere)

## v1.23 - The Cleanup Update [11/2/2023]
- Server
  - Streamers must now select a primary channel (at most one per platform) to stream on
  - Optimised channel linking and improved scalability of some streamer-specific functionality
  - Removed viewership tracking and removed old punishment table
  - Removed server log tracking
  - Removed API schema
  - External chat emojis are now keyed against the URL instead of some inconsistently constructed string
- Studio
  - Added UI for setting a linked channel to be primary or unsetting it as primary
  - Some sections are now rank-gated

## v1.22 - The Link Update [26/1/2023]
- Server
  - Addition of commands - these are any chat messages starting with `!`
    - Commands do not count towards experience
  - Ability for users to link channels to their registered ChatMate account
    - Users generate a link token on Studio which primes the link between their account and the selected channel
    - To execute the link, the channel that is to be linked must send the command `!link <link token>`
    - When linking multiple channels, all experience, ranks, and donations are merged
    - Only admins can undo links, if required
  - Overhaul of the internal handling of different user types and consistent annotations/variable names to un-ambiguously indicate intent
    - Default Users: The Chat Users that are directly attached to YouTube or Twitch channels. They may be linked to zero or one Aggregate User.
    - Aggregate Users: The Chat Users that are directly attached to Registered Users. There is a one-to-one relationship between Aggregate and Registered Users, and a one-to-many relationship to Default Users.
    - Primary Users: Refers to the single Aggregate User if the user is linked to one, or the single Default User otherwise.
    - Experience, ranks, and donations, are consistently linked to Primary Users. This means that no match would be returned for getting a Default User's rank if that user has been linked to an Aggregate User.
- Studio
  - Added Link page
    - Users can create new tokens, view their currently linked channels, and view their link history
    - Admins can manually link users or remove existing links, as well as view other users' linked channels and histories

## v1.21 - The Auth Update [20/11/2022]
- Server
  - Added the ability to register as a user, and for registered users to authenticate themselves. Registered Users may be linked to Chat Users 
  - Added the concept of Streamers. Almost all data is now isolated within the context of a Streamer, such as experience, custom emojis, donations, and ranks
  - Added streamlined guards to API endpoints. Some endpoints now require one or more of the following:
    - A loginToken header
    - A Streamer name header
    - The logged-in user to have a certain rank (in the context of the Streamer or, if no Streamer context exists, globally)
- Studio
  - Added a registration form to become a Streamer, and a way for admins to approve/rejects applications
  - Added the ability to log in/out
  - Added the ability to choose the streamer context
  - All API requests now use the loginToken and Streamer name, if set

## v1.20 - The Donation Update v2 [28/10/2022]
- Server
  - Custom emojis now have a new flag that allows them to be used within donation messages (enabled by default)
  - ChatMate now tracks the versions of custom emojis, and any usages in chat/donation messages immutably point to the latest version of an emoji
- Studio
  - Added checkbox to indicate whether a custom emoji can be u sed in donation messages

## v1.19 - The Pre-Auth Update [8/10/2022]
- Server
  - The YouTube access token is now persisted to the database instead of being applied via environment variables
  - API errors now return the correct HTTP error code
  - Code improvements and refactoring
- Studio
  - Added debug info section that periodically polls the server status, API status, and more
  - Code improvements and refactoring

## v1.18 - The Quality Update [30/9/2022]
- Server
  - Custom emojis can now be assigned a rank requirement (rank whitelist), on top of the existing level requirement. If set, a user must have at least one of the whitelisted rank to be able to use the emoji
- Studio
  - Added checkbox selection for choosing whitelisted ranks for a custom emoji

## v1.17 - The Donation Update [14/9/2022]
- Server
  - Added Websocket for listening to Streamlabs donations
  - Added the ability to get the list of donations and link/unlink a user to/from a donation
    - When linking/unlinking a user, that user will have the appropriate donation ranks added/renewed/revoked
    - Donator rank: The user has made a donation. Active for 6 months.
    - Supporter rank: The user has made at least $50 in donations over the last 6 months. Active for 6 months.
    - Member rank: The user has made a donation at least once every month for at least 3 months in a row. Active for 1 month.

## v1.16 - The Rank Update [15/8/2022]
- Server
  - Added ranks
    - They work similar to the existing punishments, but punishments are now simply one of several groups of ranks
    - Features database-level validation
    - Notably, there is a mod rank that is backed by the Youtube/Twitch moderator functionality
  - Standardised build scripts and environments
- Masterchat
  - Improved handling for invalid credentials

## v1.15 - The Stress Test Update [30/7/2022]
- Server
  - Significantly improved performance of the GET /experience/leaderboard endpoint
  - Significantly improved Webpack building times by adding an option to skip type checks
  - Fixed DB timeout during busy periods requiring App restart to fix

## v1.14 - The Deployment Update [13/7/2022]
- Server
  - Added CI for building and testing the project when pushing to GitHub, including automatic deployment to Azure
  - Livestreams are now dynamic - the server can function just fine without an active livestream, and can have the current livestream switched during runtime
  - Removed the old output folder structure. Everything now builds into the `dist` folder
  - Added better environment variable definitions and validity checks
  - Logged error/warning times are now cached during runtime for quick notifications of potential problems
- Studio
  - Added CI for building when pushing to GitHub, including automatic deployment to Azure
  - Added the ability to get and set the current active livestream
  - A summary of the server's logged errors/warnings is now shown

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
