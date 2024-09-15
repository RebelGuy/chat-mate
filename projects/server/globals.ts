import { NoNever, Primitive } from '@rebel/shared/types'
import dotenv from 'dotenv'
import { toConstCase } from '@rebel/shared/util/text'

/** Always returns T if running the server locally, otherwise null. */
type LocalVariable<T extends Primitive | null> = { type: 'local', value: T | null }

type OptionalLocalVariable<T extends Primitive | null, TDefault extends T> = { type: 'optional' | 'local', value: T | null, default: TDefault | null }

/** Always returns T if running the server in Azure, otherwise null. */
type DeploymentVariable<T extends Primitive | null> = { type: 'deployment', value: T | null }

type OptionalVariable<T extends Primitive | null, TDefault extends T> = { type: 'optional', value: T, default: TDefault }

const NODE_ENV_VALUES = ['local', 'debug', 'release'] as const
export type NodeEnv = (typeof NODE_ENV_VALUES)[number]


const LOG_OUTPUT_VALUES = ['full', 'file', 'disable'] as const
/** `'full'`: log to console and file. `'log'`: log to file. `'disable'`: don't log anything. */
export type LogOutput = (typeof LOG_OUTPUT_VALUES)[number]

const LOG_LEVEL_VALUES = ['full', 'error', 'warning', 'info', 'disable'] as const
/** The minimum log level to include in the output (specified by `LogOutput`). Anything below will be discarded. */
export type LogLevel = (typeof LOG_LEVEL_VALUES)[number]

// these can be set either statically in the .env file or Azure configuration, or dynamically within the npm script using the `cross-env` package.
type EnvironmentVariables = {
  nodeEnv: NodeEnv

  port: number
  studioUrl: string

  twitchClientId: string
  twitchClientSecret: string
  twitchUsername: string

  chatMateRegisteredUserName: string

  streamlabsAccessToken: string

  youtubeClientId: string
  youtubeClientSecret: string
  channelId: string

  databaseUrl: string

  disableExternalApis: OptionalLocalVariable<boolean, false>

  ngrokAuthToken: LocalVariable<string>

  applicationinsightsConnectionString: DeploymentVariable<string>
  websiteHostname: DeploymentVariable<string>

  dbLogLevel: OptionalVariable<LogLevel, 'info'>
  apiLogLevel: OptionalVariable<LogLevel, 'warning'>
  debugLogOutput: OptionalVariable<LogOutput, 'disable'>
  infoLogOutput: OptionalVariable<LogOutput, 'full'>
  warningLogOutput: OptionalVariable<LogOutput, 'full'>
  errorLogOutput: OptionalVariable<LogOutput, 'full'>

  dbSemaphoreConcurrent: OptionalVariable<number, 1000>
  dbSemaphoreTimeout: OptionalVariable<number | null, null>
  dbTransactionTimeout: OptionalVariable<number, 5000>
  dbSlowQueryThreshold: OptionalVariable<number, 10000>

  s3Region: string
  s3Domain: string
  s3Key: string
  s3Secret: string
  s3Bucket: string
}

// includes the variable name and allowed values. set the allowed values to null to not restrict the values to a set.
const allChatMateEnvVariables: { [K in keyof EnvironmentVariables]: readonly ValueType<K>[] | null } = {
  applicationinsightsConnectionString: null,
  channelId: null,
  youtubeClientId: null,
  youtubeClientSecret: null,
  databaseUrl: null,
  dbLogLevel: LOG_LEVEL_VALUES,
  apiLogLevel: LOG_LEVEL_VALUES,
  debugLogOutput: LOG_OUTPUT_VALUES,
  infoLogOutput: LOG_OUTPUT_VALUES,
  warningLogOutput: LOG_OUTPUT_VALUES,
  errorLogOutput: LOG_OUTPUT_VALUES,
  dbSemaphoreConcurrent: null,
  dbSemaphoreTimeout: null,
  dbTransactionTimeout: null,
  dbSlowQueryThreshold: null,
  websiteHostname: null,
  nodeEnv: NODE_ENV_VALUES,
  port: null,
  studioUrl: null,
  twitchClientId: null,
  twitchClientSecret: null,
  disableExternalApis: null,
  ngrokAuthToken: null,
  streamlabsAccessToken: null,
  twitchUsername: null,
  chatMateRegisteredUserName: null,
  s3Region: null,
  s3Domain: null,
  s3Key: null,
  s3Secret: null,
  s3Bucket: null
}
const allKeys = Object.keys(allChatMateEnvVariables) as (keyof EnvironmentVariables)[]

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

// local variables can only be accessed when running the server locally, and return null otherwise.
const localVariables: Record<VariablesOfType<'local'>, true> = {
  disableExternalApis: true,
  ngrokAuthToken: true
}

// deployment variables can only be accessed when running the server in Azure, and return null otherwise.
const deploymentVariables: Record<VariablesOfType<'deployment'>, true> = {
  applicationinsightsConnectionString: true,
  websiteHostname: true,
}

// optional variables resolve to the default value if they are not included in the environment definition.
const optionalVariables: OptionalVariablesWithDefaults = {
  disableExternalApis: false,
  dbLogLevel: 'info',
  apiLogLevel: 'warning',
  debugLogOutput: 'disable',
  infoLogOutput: 'full',
  warningLogOutput: 'full',
  errorLogOutput: 'full',
  dbSemaphoreConcurrent: 1000,
  dbSemaphoreTimeout: null,
  dbTransactionTimeout: 5000,
  dbSlowQueryThreshold: 10000
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

function assertValidValue<V extends keyof EnvironmentVariables> (variable: V, value: ValueType<V>): void {
  const validValues = allChatMateEnvVariables[variable]
  if (validValues == null) {
    return
  } else if (validValues.includes(value)) {
    return
  } else {
    throw new Error(`Invalid value for environment variable ${toConstCase(variable)}. Allowed values are ${JSON.stringify(validValues)}, but was ${JSON.stringify(value)}`)
  }
}

// if an environment variable is included in this list, it must be set using the `cross-env` package.
const injectedVariables: (keyof EnvironmentVariables)[] = [
  'nodeEnv',
]

let missingInjectedVars: string[] = []
for (const key of injectedVariables) {
  if (isOptionalVar(key)) {
    continue
  }

  const envName = toConstCase(key)
  if (process.env[envName] === undefined) {
    missingInjectedVars.push(envName)
  }
}

if (missingInjectedVars.length > 0) {
  throw new Error('The following required environment variables have not been set: ' + missingInjectedVars.join(', ') + '. The list of set variables is: ' + Object.keys(process.env).join(', '))
}

// `nodeEnv` is special because it modifies the environment variable collection
const nodeEnvKey: keyof EnvironmentVariables = 'nodeEnv'
const nodeEnv = parseValue<ValueType<'nodeEnv'>>(process.env[toConstCase(nodeEnvKey)])
const isLocal = nodeEnv === 'local'

// separate debug/release .env files
const dotenvFile = `./${nodeEnv}.env`
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
    return optionalVariables[variable as keyof OptionalVariablesWithDefaults] as ValueType<V>
  } else {
    throw new Error(`Cannot find non-optional environment variable ${envName}`)
  }

  const parsed = parseValue<Primitive | null>(value) as ValueType<V>
  assertValidValue(variable, parsed)
  return parsed
}

function parseValue<T extends Primitive | null> (value: string | null | undefined): T {
  let result
  if (value == null || value.length === 0 || value === 'null') {
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
