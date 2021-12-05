import { assert, toConstCase } from '@rebel/util'
import dotenv from 'dotenv'

// these can be set either statically in the .env file, or dynamically within the npm script using the `cross-env` package.
type EnvironmentVariables = {
  nodeEnv: 'debug' | 'release'
  port: number

  // authentication token passed into Masterchat
  auth: string

  channelId: string
  liveId: string
}

// if an environment variable is included in this list, it must be set using the `cross-env` package.
const injectedEnvironmentVariables: (keyof EnvironmentVariables)[] = [
  'nodeEnv'
]

injectedEnvironmentVariables.map(variable => {
  const envName = toConstCase(variable)
  assert(Object.keys(process.env).includes(envName), `Environment variable '${envName}' must be injected`)
})

// separate debug/release .env files
dotenv.config({ path: `./${env('nodeEnv')}.env`})

export default function env<V extends keyof EnvironmentVariables> (variable: V): EnvironmentVariables[V] {
  const envName = toConstCase(variable)

  if (Object.keys(process.env).includes(envName)) {
    return process.env[envName] as EnvironmentVariables[V]
  } else {
    throw new Error(`Cannot find environment variable ${envName}`)
  }
}
