import dotenv from 'dotenv'

dotenv.config()

type EnvironmentVariables = {
  port: number,
}

export default function env<V extends keyof EnvironmentVariables>(variable: V): EnvironmentVariables[V] {
  let lastCapital = 0
  let underscores: number[] = []
  for (let i = 1; i < variable.length; i++) {
    const char = variable[i]
    const isCapital = char === char.toUpperCase()
    
    if (isCapital && i - lastCapital > 1) {
      underscores.push(i)
    }
  }

  let envName = variable as string
  for (let i = underscores.length - 1; i >= 0; i--) {
    const pos = underscores[i]
    envName = envName.substring(0, pos - 1) + '_' + envName.substring(pos)
  }

  const result: EnvironmentVariables[V] | undefined = process.env[envName] as EnvironmentVariables[V] | undefined
  if (result == null) {
    throw new Error(`Cannot find environment variable ${envName}`)
  }
  return result
}