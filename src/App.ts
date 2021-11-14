import express from "express"
import chat from "./controllers/chat"
import env from "./Globals"


export const app = express()
const port = env('port')

app.use(
  chat
)

app.listen(port, () => {
  return console.log(`Server is listening on ${port}`)
})
