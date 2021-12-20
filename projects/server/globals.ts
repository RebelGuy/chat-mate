import { OptionalKeys, Optionals } from '@rebel/server/types'
import { URL } from 'node:url'
import dotenv from 'dotenv'
import { toConstCase } from '@rebel/server/util/text'
import assert from 'node:assert'

// always returns T if in a debug enviroment, otherwise always returns null
type DebugVariable<T> = T | null

export type NodeEnv = 'debug' | 'release'

// these can be set either statically in the .env file, or dynamically within the npm script using the `cross-env` package.
type EnvironmentVariables = {
  nodeEnv: NodeEnv
  port: number

  // authentication token passed into Masterchat
  auth: string

  channelId: string
  liveId: string
  databaseUrl: string

  // id for auto-replaying chat messages
  isMockLivestream?: DebugVariable<boolean>
}

// if an environment variable is included in this list, it must be set using the `cross-env` package.
const injectedVariables: (keyof EnvironmentVariables)[] = [
  'nodeEnv'
]

injectedVariables.map(variable => {
  const envName = toConstCase(variable)
  assert(Object.keys(process.env).includes(envName), `Environment variable '${envName}' must be injected`)
})

// debug variables can only be accessed in a debug environment, and return null otherwise.
const debugVariables: (keyof EnvironmentVariables)[] = [
  'isMockLivestream'
]

// optional variables resolve to a value of null if they are not included in the environment definition.
const optionalVariables: Record<OptionalKeys<EnvironmentVariables>, true> = {
  isMockLivestream: true
}

function isOptional<V extends keyof EnvironmentVariables> (variable: V): boolean {
  return Object.keys(optionalVariables).includes(variable)
}

// separate debug/release .env files
dotenv.config({ path: `./${env('nodeEnv')}.env`})

// returns the set value, or null
export default function env<V extends keyof EnvironmentVariables> (variable: V): Required<EnvironmentVariables>[V] {
  const envName = toConstCase(variable)

  let value: string | null
  if (Object.keys(process.env).includes(envName)) {
    if (debugVariables.includes(variable) && env('nodeEnv') === 'release') {
      value = null
    } else {
      value = process.env[envName]!
    }
  } else if (isOptional(variable)) {
    value = null
  } else {
    throw new Error(`Cannot find non-optional environment variable ${envName}`)
  }

  let result
  if (value === null || value!.length === 0) {
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
