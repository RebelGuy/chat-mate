import express from "express"
import { GET, Path, QueryParam, Server } from "typescript-rest"
import {ChatController} from "./controllers/ChatController"
import env from "./globals"

export const app = express()
const port = env('port')


// this is middleware - we can supply an ordered collection of such functions,
// and they will run in order to do common operations on the request before it
// reaches the controllers.
// app.use((req, res, next) => {
//   // todo: do auth here, and fail if not authorised

//   // go to the next handler
//   next()
// })

// Server.registerServiceFactory(null as any)

Server.buildServices(app, ChatController)
// Server.loadControllers(app, './src/controllers/ChatController.ts')

app.listen(port, () => {
  console.log(`Server is listening on ${port}`)
})
