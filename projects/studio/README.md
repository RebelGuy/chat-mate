# Project
ChatMate Studio is a public work-in-progress React web-interface for streamers and viewers that interacts with the ChatMate API. The frontend uses the `mui` package for pre-built components and styles.

## Deployments
- [Local](http://localhost:3000)
- [Sandbox](https://www.chat-mate-sandbox.com)
- [Production](https://www.chat-mate.com)

## Typescript/alias configuration
In order to get `@rebel` importing to work, we needed to override the webpack configuration that `react-app` hides from us. To do this, we use `react-app-rewired` (config in `config-overrides.js`) which works for most of the cases, but it was unhappy about imports from a different project, and imports outside of the `src` folder are apparently not allowed. As a workaround, we use `react-app-rewire-alias`, which is configured by `react-app-rewired`, and requires a special `tsconfig` file to re-define the path aliases it should already know about (from the base `tsconfig`). So the inheritance for this project is:

`../../tsconfig.base.json` -> `tsconfig.paths.json` -> `tsconfig.json`

## Environment variables
The following environment variables are required to run the Studio app. They can be set either via a file called `.env`, or directly via the process environment. The `.env` file always takes precedence.

All environment variables **must** be of the form `REACT_APP_<VARIABLE_NAME>` and will be baked directly into the built files - **they must be provided during the build, as they cannot be modified at runtime**.

- `SERVER_URL`: The URL of the server without a trailing slash.
- `REACT_APP_STUDIO_VERSION_HASH`: The Studio version (e.g. 1.0.0) and latest commit hash, separated by a space.

## Scripts
- `start`: For local development. Builds and watches the source files, then starts up the development server and serves the static app. Does not emit files.
- `build`: For CI. Builds the app in production mode into the `./build` folder.
