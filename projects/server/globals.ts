import { OptionalKeys } from '@rebel/server/types'
import dotenv from 'dotenv'
import { toConstCase } from '@rebel/server/util/text'
import assert from 'node:assert'

// always returns T if in a debug enviroment, otherwise always returns null
type DebugVariable<T> = T | null

export type NodeEnv = 'debug' | 'release'

export type BuildType = 'tsc' | 'webpack'

// these can be set either statically in the .env file, or dynamically within the npm script using the `cross-env` package.
type EnvironmentVariables = {
  nodeEnv: NodeEnv
  build: BuildType
  port: number

  // authentication token passed into Masterchat
  auth: string

  channelId: string
  liveId: string
  databaseUrl: string

  // id for auto-replaying chat messages
  isMockLivestream?: DebugVariable<boolean>

  // replaces some controllers with fake ones
  useFakeControllers?: DebugVariable<boolean>
}

// if an environment variable is included in this list, it must be set using the `cross-env` package.
const injectedVariables: (keyof EnvironmentVariables)[] = [
  'nodeEnv',
  'build'
]

injectedVariables.map(variable => {
  const envName = toConstCase(variable)
  const keys = Object.keys(process.env).filter(key => !key.startsWith('npm_'))
  assert(keys.includes(envName), `Environment variable '${envName}' must be injected. Process.env keys: ${keys.join(', ')}`)
})

// debug variables can only be accessed in a debug environment, and return null otherwise.
const debugVariables: (keyof EnvironmentVariables)[] = [
  'isMockLivestream',
  'useFakeControllers'
]

// optional variables resolve to a value of null if they are not included in the environment definition.
const optionalVariables: Record<OptionalKeys<EnvironmentVariables>, true> = {
  isMockLivestream: true,
  useFakeControllers: true
}

function isOptional<V extends keyof EnvironmentVariables> (variable: V): boolean {
  return Object.keys(optionalVariables).includes(variable)
}

// separate debug/release .env files
const dotenvFile = `./${process.env.NODE_ENV}.env`
const dotenvResult = dotenv.config({ path: dotenvFile})
if (dotenvResult.error) {
  throw new Error(`Unable to load dot-env file at ${dotenvFile} : ` + dotenvResult.error.message)
} else if (dotenvResult.parsed == null) {
  throw new Error(`Managed to load dot-env file at ${dotenvFile} but result was null`)
}

// we can't just read everything off process.env
// because webpack thinks it knows what env variables
// we will have and over-optimises the code.
const allEnvVariables: Record<string, string | undefined> = {
  ...dotenvResult.parsed,

  // injected variables take precedence
  ...process.env
}

// returns the set value, or null
export default function env<V extends keyof EnvironmentVariables> (variable: V): Required<EnvironmentVariables>[V] {
  const envName = toConstCase(variable)

  let value: string | null
  if (Object.keys(allEnvVariables).includes(envName)) {
    if (debugVariables.includes(variable) && env('nodeEnv') === 'release') {
      value = null
    } else {
      value = allEnvVariables[envName]!
    }
  } else if (isOptional(variable)) {
    value = null
  } else {
    throw new Error(`Cannot find non-optional environment variable ${envName}`)
  }

  let result
  if (value === null || value.length === 0) {
    result = null
  } else {
    const processedValue = value.trim().toLowerCase()
    if (processedValue === 'true') {
      result = true
    } else if (processedValue === 'false') {
      result = false
    } else {
      const maybeNumber = Number(processedValue)
      if (!isNaN(maybeNumber)) {
        result = maybeNumber
      } else {
        result = value
      }
    }
  }
  
  return result as Required<EnvironmentVariables>[V]
}
