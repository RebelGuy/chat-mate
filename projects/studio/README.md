# Project

## Typescript/alias configuration

In order to get `@rebel` importing to work, we needed to override the webpack configuration that `react-app` hides from us. To do this, we use `react-app-rewired` (config in `config-overrides.js`) which works most of the case, but it was unhappy about one particular import from the `server` project, because it was from outside the `src` folder which is apparently not allowed. As a workaround, we use `react-app-rewire-alias`, which is configured by `react-app-rewired`, and requires a special `tsconfig` file to re-define the path aliases it should already know about (from the base `tsconfig`). So the inheritance for this project is:

`../../tsconfig.base.json` -> `tsconfig.paths.json` -> `tsconfig.json`

## Environment variables

The following environment variables are required to run the studio app. They can be set either via a file called `.env`, or directly via the process environment. The `.env` file always takes precedence.

All environment variables **must** be of the form `REACT_APP_<VARIABLE_NAME>` and will be baked directly into the built files - **they must be provided during the build, as they cannot be modified at runtime**.

- `SERVER_API_URL`: The API base path of the server without a trailing slash.

## Scripts

Note that you will first need to build the `server` project so that we can import its emitted files.

- `start`: For local development. Builds and watches the source files, then starts up the development server and serves the static app. Does not emit files.
- `build`: For CI. Builds the app in production mode into the `./build` folder.
