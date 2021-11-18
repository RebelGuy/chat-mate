import express from "express"
import { Server } from "typescript-rest"
import ChatStore from "./stores/ChatStore"
import { ChatController } from "@controllers/ChatController"
import env from "./globals"
import ServiceFactory from "./context/ServiceFactory"
import { ContextProvider, setContextProvider } from '@context/ContextProvider'

export const app = express()
const port = env('port')


// this is middleware - we can supply an ordered collection of such functions,
// and they will run in order to do common operations on the request before it
// reaches the controllers.
app.use((req, res, next) => {
  // todo: do auth here, and fail if not authorised

  // go to the next handler
  next()
})

app.use((req, res, next) => {
  // todo: allow a context to depend on another one (optional contextProvider object in contextProvider constructor) (we don't need this actually)
  // todo: make a persistent context that doens't reset on every request (i.e. i.e. not like the controllers)
  setContextProvider(req, new ContextProvider().withClass(ChatStore))
  next()
})

// for each request, the Server will instantiate a new instance of each Controller.
// since we want to inject dependencies, we need to provide a custom implementation.
Server.registerServiceFactory(new ServiceFactory())

// tells the server which classes to use as Controllers
Server.buildServices(app,
  ChatController,
)

// start
app.listen(port, () => {
  console.log(`Server is listening on ${port}`)
})
