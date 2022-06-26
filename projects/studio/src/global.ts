// beautiful use of the template literal type!
function requireVariable (environmentVariable: `REACT_APP_${string}`): string {
  const value = process.env[environmentVariable]
  if (value == null || value === '') {
    throw new Error(`Environment variable ${environmentVariable} is required but was not found.`)
  } else {
    return value
  }
}

export const SERVER_API_URL = requireVariable('REACT_APP_SERVER_API_URL')
