import { ServiceContext, ServiceFactory } from 'typescript-rest'
import { getContextProvider } from './ContextProvider'

export default class CustomServiceFactory implements ServiceFactory {
  // Create a new service object. Called before each request handling.
  public create (serviceClass: Function, context: ServiceContext) {
    const contextProvider = getContextProvider(context.request)
    return contextProvider.contextualise(serviceClass)
  }

  // Return the type used to handle requests to the target service.
  // By default, returns the serviceClass received, but you can use this
  // to implement IoC integrations.
  public getTargetClass (serviceClass: Function): FunctionConstructor {
    // pass through the default constructor
    return serviceClass as FunctionConstructor
  }
}
