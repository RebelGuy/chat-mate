import ContextClass from '@rebel/shared/context/ContextClass'
import { ChatMateError } from '@rebel/shared/util/error'
import sizeOf from 'image-size'

export default class ImageService extends ContextClass {
  public getImageDimensions (base64Data: string) {
    const buffer = Buffer.from(base64Data, 'base64')
    const dimensions = sizeOf(buffer)

    if (dimensions.width == null || dimensions.height == null) {
      throw new ChatMateError('Unable to determine dimensions of image')
    }

    return { width: dimensions.width, height: dimensions.height }
  }
}
