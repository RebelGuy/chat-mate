import { NoNever, OptionalKeys, Primitive } from '@rebel/server/types'
import dotenv from 'dotenv'
import { toConstCase } from '@rebel/server/util/text'
import assert from 'node:assert'
console.log(process.env)
/** Always returns T if running the server locally, otherwise null. */
type LocalVariable<T extends Primitive | null> = { type: 'local', value: T | null }

type OptionalLocalVariable<T extends Primitive | null, TDefault extends T> = { type: 'optional' | 'local', value: T | null, default: TDefault | null }

/** Always returns T if running the server in Azure, otherwise null. */
type DeploymentVariable<T extends Primitive | null> = { type: 'deployment', value: T | null }

type OptionalVariable<T extends Primitive | null, TDefault extends T> = { type: 'optional', value: T, default: TDefault }

export type NodeEnv = 'debug' | 'release'

export type BuildType = 'tsc' | 'webpack'

// these can be set either statically in the .env file, or dynamically within the npm script using the `cross-env` package.
type EnvironmentVariables = {
  nodeEnv: NodeEnv
  build: BuildType
  // whether we are running the app locally
  isLocal: OptionalVariable<boolean, false>

  port: number

  // authentication token passed into Masterchat
  auth: string

  twitchClientId: string
  twitchClientSecret: string
  twitchChannelName: string
  twitchAccessToken: string
  twitchRefreshToken: string

  channelId: string
  databaseUrl: string

  // replaces some controllers with fake ones
  useFakeControllers: OptionalLocalVariable<boolean, false>

  applicationinsightsConnectionString: DeploymentVariable<string>
  websiteHostname: DeploymentVariable<string>

  // if false, will still log warnings and errors
  enableDbLogging: OptionalVariable<boolean, false>
}

function getAllKeys () {
  // wrapped in a function to stop polluting the top-level scope
  const allEnvVariables: Record<keyof EnvironmentVariables, true> = {
    'applicationinsightsConnectionString': true,
    'auth': true,
    'build': true,
    'channelId': true,
    'databaseUrl': true,
    'enableDbLogging': true,
    'websiteHostname': true,
    'isLocal': true,
    'nodeEnv': true,
    'port': true,
    'twitchAccessToken': true,
    'twitchChannelName': true,
    'twitchClientId': true,
    'twitchClientSecret': true,
    'twitchRefreshToken': true,
    'useFakeControllers': true
  }
  return Object.keys(allEnvVariables) as (keyof EnvironmentVariables)[]
}
const allKeys = getAllKeys()

type VariablesOfType<Type extends 'local' | 'deployment' | 'optional'> = keyof NoNever<{
  [K in keyof EnvironmentVariables]:
    Exclude<EnvironmentVariables[K], undefined> extends { type: infer _Type }
      ? _Type extends Type ? K : never // this is required to be able to match against a composite type
      : never
}>

type OptionalVariablesWithDefaults = NoNever<{
  [K in keyof EnvironmentVariables]: K extends VariablesOfType<'optional'> ? EnvironmentVariables[K]['default'] : never
}>

type ValueType<V extends keyof EnvironmentVariables> = EnvironmentVariables[V] extends { value: infer Value } ? Value : EnvironmentVariables[V]

// if an environment variable is included in this list, it must be set using the `cross-env` package.
const injectedVariables: (keyof EnvironmentVariables)[] = [
  'nodeEnv',
  'build',
  'isLocal' // has to be injected because it's used by webpack
]

injectedVariables.map(variable => {
  const envName = toConstCase(variable)
  const keys = Object.keys(process.env).filter(key => !key.startsWith('npm_'))
  assert(keys.includes(envName), `Environment variable '${envName}' must be injected. Process.env keys: ${keys.join(', ')}`)
})

// local variables can only be accessed when running the server locally, and return null otherwise.
const localVariables: Record<VariablesOfType<'local'>, true> = {
  useFakeControllers: true
}

// deployment variables can only be accessed when running the server in Azure, and return null otherwise.
const deploymentVariables: Record<VariablesOfType<'deployment'>, true> = {
  applicationinsightsConnectionString: true,
  websiteHostname: true
}

// optional variables resolve to the default value if they are not included in the environment definition.
const optionalVariables: OptionalVariablesWithDefaults = {
  useFakeControllers: false,
  enableDbLogging: false,
  isLocal: false
}

function isOptionalVar<V extends keyof EnvironmentVariables> (variable: V): boolean {
  return Object.keys(optionalVariables).includes(variable)
}

function isLocalVar<V extends keyof EnvironmentVariables> (variable: V): boolean {
  return Object.keys(localVariables).includes(variable)
}

function isDeploymentVar<V extends keyof EnvironmentVariables> (variable: V): boolean {
  return Object.keys(deploymentVariables).includes(variable)
}

// separate debug/release .env files
const dotenvFile = `./${process.env.NODE_ENV}.env`
const dotenvResult = dotenv.config({ path: dotenvFile})
if (dotenvResult.error) {
  console.error(`Unable to load dot-env file at ${dotenvFile} : ` + dotenvResult.error.message)
  dotenvResult.parsed = {}
} else if (dotenvResult.parsed == null) {
  console.error(`Managed to load dot-env file at ${dotenvFile} but result was null`)
  dotenvResult.parsed = {}
}

// we can't just read everything off process.env
// because webpack thinks it knows what env variables
// we will have and over-optimises the code.
const allEnvVariables: Record<string, string | undefined> = {
  ...dotenvResult.parsed,

  // injected variables take precedence
  ...process.env
}

// `isLocal` is special because it modifies the environment variable collection
const isLocalKey: keyof EnvironmentVariables = 'isLocal'
const isLocal = parseValue<ValueType<'isLocal'>>(allEnvVariables[toConstCase(isLocalKey)]) ?? optionalVariables[isLocalKey]

// before continuing, check that all non-optional variables have been provided
let missingVars: string[] = []
for (const key of allKeys) {
  if (isOptionalVar(key) || isLocal && isDeploymentVar(key) || !isLocal && isLocalVar(key)) {
    continue
  }

  const envName = toConstCase(key)
  const varExists = Object.keys(allEnvVariables).includes(envName)
  if (!varExists) {
    missingVars.push(envName)
  }
}

if (missingVars.length > 0) {
  throw new Error('The following required environment variables have not been set: ' + missingVars.join(', ') + '. The list of set variables is: ' + Object.keys(allEnvVariables).join(', '))
}

// returns the set value, or null
export default function env<V extends keyof EnvironmentVariables> (variable: V): ValueType<V> {
  const envName = toConstCase(variable)
  if (isLocal && Object.keys(deploymentVariables).includes(variable)) {
    return null as ValueType<V>
  } else if (!isLocal && Object.keys(localVariables).includes(variable)) {
    return null as ValueType<V>
  }

  let value: string
  if (Object.keys(allEnvVariables).includes(envName)) {
    value = allEnvVariables[envName]!
  } else if (isOptionalVar(variable)) {
    // disgusting casting
    return optionalVariables[isLocalKey as keyof OptionalVariablesWithDefaults] as ValueType<V>
  } else {
    throw new Error(`Cannot find non-optional environment variable ${envName}`)
  }

  return parseValue<Primitive | null>(value) as ValueType<V>
}

function parseValue<T extends Primitive | null> (value: string | null | undefined): T {
  let result
  if (value == null || value.length === 0) {
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

  return result as T
}
