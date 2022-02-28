# Project

## Typescript/alias configuration

In order to get `@rebel` importing to work, we needed to override the webpack configuration that `react-app` hides from us. To do this, we use `react-app-rewired` (config in `config-overrides.js`) which works most of the case, but it was unhappy about one particular import from the `server` project, because it was from outside the `src` folder which is apparently not allowed. As a workaround, we use `react-app-rewire-alias`, which is configured by `react-app-rewired`, and requires a special `tsconfig` file to re-define the path aliases it should already know about (from the base `tsconfig`). So the inheritance for this project is:

`../../tsconfig.base.json` -> `tsconfig.paths.json` -> `tsconfig.json`
