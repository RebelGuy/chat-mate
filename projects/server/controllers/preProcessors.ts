import { RankName } from '@prisma/client'
import { getContextProvider } from '@rebel/server/context/context'
import ApiService from '@rebel/server/controllers/ApiService'
import { PreProcessorError } from '@rebel/server/util/error'
import { toCamelCase } from '@rebel/server/util/text'
import { Request, Response } from 'express'

/** User must have a valid login token attached to the request. The `registeredUser` context variable will be available during the request. */
export function requireAuth (req: Request, res?: Response) {
  return preProcessorWrapper(req, res, async (apiService) => {
    await apiService.authenticateCurrentUser()
    await apiService.hydrateRanks()
  })
}

/** User must be logged in, and specify the streamer (of which they are a viewer). Both the `registeredUser` and `streamerId` context variables will be available during the request. */
export function requireStreamer (req: Request, res?: Response) {
  return preProcessorWrapper(req, res, async (apiService) => {
    await requireAuth(req, res)
    await apiService.extractStreamerId()
  })
}

/** Ensures that the logged-in user has any of the given ranks, or above.
 * By default, only global ranks will be considered. If you also need streamer-specific ranks, use the `requireStreamer` preProcessor prior to this one.
 * The `registeredUser`context variable will be available during the request. */
export function requireRank (firstRank: RankName, ...ranks: RankName[]) {
  return async (req: Request, res?: Response) => {
    return preProcessorWrapper(req, res, async (apiService) => {
      await requireAuth(req, res)
      await apiService.hydrateRanks()

      const hasAccess = [firstRank, ...ranks].find(r => !apiService.hasRankOrAbove(r)) == null
      if (!hasAccess) {
        throw new PreProcessorError(403, 'Forbidden')
      }
    })
  }
}

/** Any `PreProcessorError` errors thrown in the `handler` will terminate the current request. */
async function preProcessorWrapper (req: Request, res: Response | undefined, handler: (apiService: ApiService) => Promise<void>) {
  const context = getContextProvider(req)
  const apiService = context.getClassInstance(toCamelCase(ApiService.name)) as ApiService

  try {
    await handler(apiService)
  } catch (e: any) {
    if (res == null) {
      throw new Error('Unable to send response because the response object was undefined.')
    }

    if (e instanceof PreProcessorError) {
      res.status(e.statusCode).send(e.message)
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
