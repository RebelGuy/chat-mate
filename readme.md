At the moment, the main project in `chat-mate` is `./projects/server`. It communicates with YouTube, the Minecraft client, and the database.

To get things running, ensure Node 16 is installed, and a global version of yarn exists (`npm install --global yarn`). If running `yarn --version` fails, run PowerShell as an administrator and execute the command `Set-ExecutionPolicy Unrestricted`. Note that packages should be added using `yarn add <packageName> [--dev]` **in their respective workspace**.

Recommended extensions:
- `TSLint (deprecated)`
- `Gitlens`
- `Prisma`

# Change Log
## v1.4 - The Test Update
- Server
  - Added yarn workspaces and webpack bundling

## v1.3 - The Database Update
- Server
  - Added Prisma and MySQL database
  - Added database migration scripts
  - Fixed Webpack bundling
  - Updated ChatController return model

## v1.2 - The Development Update
- Server
  - Added separate debug/release environments (.env file, /data folder, and build output)
  - Added `MockMasterchat` for more convenient testing
  - Added `LogService`
  - Project now uses yarn

## v1.1 - The Encoding Update
- Server
  - Added docs
  - LiveId can now be any YouTube link to the livestream
  - Fixed error handling

## v1.0
- Server
  - Initial release
  - Simple fetching and saving of chat messages
  - Added `GET /chat` endpoint
