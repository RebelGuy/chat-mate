import { getContextProvider } from '@rebel/server/context/context'
import ApiService from '@rebel/server/controllers/ApiService'
import { PreProcessorError } from '@rebel/server/util/error'
import { toCamelCase } from '@rebel/server/util/text'
import { Request, Response } from 'express'

export async function requireAuth (req: Request, res?: Response) {
  const context = getContextProvider(req)
  const apiService = context.getClassInstance(toCamelCase(ApiService.name)) as ApiService

  // the api service will send the request (which gets intercepted by our `send` override in `app.ts`)
  // just before throwing an error.
  // throwing errors will print a big error message in the console, but it will gracefully interrupt the middlewares flow.
  // todo: find a better way to cancel a request from within the preprocessor. at the very least, surpress the error log.
  // todo: streamline this so it's reusable (i.e. create a common PreProcessor wrapper function)
  try {
    await apiService.authenticateCurrentUser()
  } catch (e: any) {
    if (res == null) {
      throw new Error('Unable to send response because the response object was undefined.')
    }

    if (e instanceof PreProcessorError) {
      res.status(e.statusCode).send(e.message)
    } else {
      res.status(500).send('Internal server error.')
    }

    throw e
  }
}

// https://blog.logrocket.com/a-practical-guide-to-typescript-decorators/
// for the future, in case it comes in handy:
// this can be used as a decorator

// target: the class where the decorated method lives
// propertyKey: the method name (stringified)
// descriptor.value = reference to original method
const decorator = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value as (...args: any[]) => any
  const controller = target // as ControllerClass
  const propertyKey_ = propertyKey
  const descriptor_ = descriptor

  descriptor.value = function (...args: any[]) {
    console.log(controller)
    console.log(propertyKey_)
    console.log(descriptor_)
    originalMethod.apply(this, args)
  }
}