/* eslint-disable @typescript-eslint/ban-types */
import { ServiceContext, ServiceFactory } from 'typescript-rest'
import { getContextProvider } from '@rebel/shared/context/context'
import { toCamelCase } from '@rebel/shared/util/text'

export default class CustomServiceFactory implements ServiceFactory {
  // Create a new service object. Called before each request handling, for each registered Controller.
  public create (serviceClass: Function, context: ServiceContext) {
    // note: we can't simply instantiate the serviceClass and pass the dependencies to its constructor, because
    // `this` won't bind correctly and we won't be able to actually assign the dependencies to class fields.
    // We have already created the context, so we can retrieve the correct instance here.
    const contextProvider = getContextProvider(context.request)
    return contextProvider.getClassInstance(toCamelCase(serviceClass.name))
  }

  // Return the type used to handle requests to the target service.
  // By default, returns the serviceClass received, but you can use this
  // to implement IoC integrations.
  public getTargetClass (serviceClass: Function): FunctionConstructor {
    // pass through the default constructor
    return serviceClass as FunctionConstructor
  }
}
