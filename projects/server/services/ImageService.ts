import LogService from '@rebel/server/services/LogService'
import WebService from '@rebel/server/services/WebService'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { ChatMateError } from '@rebel/shared/util/error'
import sizeOf from 'image-size'
import sharp from 'sharp'

const QUESTION_MARK_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAACXBIWXMAAAsTAAALEwEAmpwYAAABG0lEQVR4nO3WLUtEQRSA4cePsGAQi4igzSL4E1yT2DSJNtkfYPZvrFXsFhWLQQSNttUkmPwIwoomEU0qF8YyzKKwd64b9oUJM3PuvNwzZ4ahTw9SQwOHuMMbPvCIY2xitGxpHQ/4+qW9YK0s6QLe/yD9aZ/YKCO9tx0EzyHVqblXTHYjXk8seo6ZMD+IlZDiOG6rG/FuYg/HEnGNhHi/G/FJtNhRh7i5hLj4NjurCfFObukEbhLi5ZzSRdwnpBeh8Eqnhu1wZmPpNcZzSAfCtZk6v8UpGFFhIbWxJDN7kbS4vWZVwGkkPlARZ5G4WZW4T2XUcRmePlfhoZCdYTxFxVX0h3KLpzvcWFP/8cftMJ6debTCHrdCv0/v8g0mCI1aliBq0AAAAABJRU5ErkJggg=='

type Deps = Dependencies<{
  webService: WebService
  logService: LogService
}>

export default class ImageService extends ContextClass {
  public readonly name = ImageService.name

  private readonly webService: WebService
  private readonly logService: LogService

  constructor (deps: Deps) {
    super()

    this.webService = deps.resolve('webService')
    this.logService = deps.resolve('logService')
  }

  public getImageDimensions (base64Data: string) {
    const buffer = Buffer.from(base64Data, 'base64')
    const dimensions = sizeOf(buffer)

    if (dimensions.width == null || dimensions.height == null) {
      throw new ChatMateError('Unable to determine dimensions of image')
    }

    return { width: dimensions.width, height: dimensions.height }
  }

  /** Returns the base64 data (does not include the data url prefix). */
  public async convertToPng (imageUrl: string): Promise<string> {
    const response = await this.webService.fetch(imageUrl)

    if (response.status === 404) {
      this.logService.logError(this, 'Unable to convert image to png from url', imageUrl, 'because it was not found. Returning question mark image instead.')
      return QUESTION_MARK_BASE64
    } else if (response.status >= 400) {
      throw new ChatMateError(`Unable to load image: Received status ${response.status}`)
    }

    if (response.headers.get('Content-Type') === 'image/png') {
      const buffer = await response.arrayBuffer()
      return Buffer.from(buffer).toString('base64')
    }

    const buffer = await sharp(await response.arrayBuffer()).png().toBuffer()
    return buffer.toString('base64')
  }
}
