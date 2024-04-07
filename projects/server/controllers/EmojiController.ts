import { ControllerDependencies, buildPath, ControllerBase } from '@rebel/server/controllers/ControllerBase'
import { requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { customEmojiToPublicObject, publicObjectToCustomEmojiUpdateData, publicObjectNewToNewCustomEmoji } from '@rebel/server/models/emoji'
import { Path, GET, POST, PATCH, PreProcessor, BodyOptions } from 'typescript-rest'
import { AddCustomEmojiRequest, AddCustomEmojiResponse, GetCustomEmojisResponse, UpdateCustomEmojiRequest, UpdateCustomEmojiResponse, UpdateCustomEmojiSortOrderRequest, UpdateCustomEmojiSortOrderResponse } from '@rebel/api-models/schema/emoji'
import EmojiService from '@rebel/server/services/EmojiService'
import CustomEmojiStore from '@rebel/server/stores/CustomEmojiStore'

type Deps = ControllerDependencies<{
  customEmojiStore: CustomEmojiStore
  emojiService: EmojiService
}>

@Path(buildPath('emoji'))
@PreProcessor(requireStreamer)
export default class EmojiController extends ControllerBase {
  private readonly customEmojiStore: CustomEmojiStore
  private readonly emojiService: EmojiService

  constructor (deps: Deps) {
    super(deps, 'emoji')
    this.customEmojiStore = deps.resolve('customEmojiStore')
    this.emojiService = deps.resolve('emojiService')
  }

  @GET
  @Path('/custom')
  public async getCustomEmojis (): Promise<GetCustomEmojisResponse> {
    const builder = this.registerResponseBuilder<GetCustomEmojisResponse>('GET /custom')
    try {
      const emojis = await this.emojiService.getAllCustomEmojis(this.getStreamerId())
      return builder.success({ emojis: emojis.map(e => customEmojiToPublicObject(e)) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/custom')
  @PreProcessor(requireRank('owner'))
  @BodyOptions({ limit: '1mb' })
  public async addCustomEmoji (request: AddCustomEmojiRequest): Promise<AddCustomEmojiResponse> {
    const builder = this.registerResponseBuilder<AddCustomEmojiResponse>('POST /custom')
    if (request == null || request.newEmoji == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    const symbol = request.newEmoji.symbol ?? ''
    if (symbol.length < 1 || symbol.length > 32) {
      return builder.failure(400, 'Symbol must be between 1 and 32 characters.')
    }

    if (symbol.includes(':')) {
      return builder.failure(400, `Symbol cannot include the character ':'`)
    }

    const imageData = request.newEmoji.imageDataUrl ?? ''
    if (imageData.length === 0) {
      return builder.failure(400, 'Image data must be defined')
    }

    try {
      const emoji = await this.emojiService.addCustomEmoji(publicObjectNewToNewCustomEmoji(request.newEmoji, this.getStreamerId()))
      return builder.success({ newEmoji: customEmojiToPublicObject(emoji) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @PATCH
  @Path('/custom')
  @PreProcessor(requireRank('owner'))
  @BodyOptions({ limit: '1mb' })
  public async updateCustomEmoji (request: UpdateCustomEmojiRequest): Promise<UpdateCustomEmojiResponse> {
    const builder = this.registerResponseBuilder<UpdateCustomEmojiResponse>('PATCH /custom')
    if (request == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    const imageData = request.updatedEmoji.imageDataUrl ?? ''
    if (imageData.length === 0) {
      return builder.failure(400, 'Image data must be defined')
    }

    try {
      const emoji = await this.emojiService.updateCustomEmoji(publicObjectToCustomEmojiUpdateData(request.updatedEmoji))
      return builder.success({ updatedEmoji: customEmojiToPublicObject(emoji) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @PATCH
  @Path('/custom/sortOrder')
  @PreProcessor(requireRank('owner'))
  public async updateCustomEmojiSortOrder (request: UpdateCustomEmojiSortOrderRequest): Promise<UpdateCustomEmojiSortOrderResponse> {
    const builder = this.registerResponseBuilder<UpdateCustomEmojiSortOrderResponse>('PATCH /custom/sortOrder')
    if (request?.sortOrders == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const ids = Object.keys(request.sortOrders).map(id => Number(id))
      if (ids.some(id => isNaN(id))) {
        return builder.failure(400, 'Invalid request data.')
      }

      const sortOrders = Object.values(request.sortOrders).map(sortOrder => Number(sortOrder))
      if (ids.some(sortOrder => isNaN(sortOrder))) {
        return builder.failure(400, 'Invalid request data.')
      }

      const accessibleIds = await this.customEmojiStore.getAllCustomEmojis(this.getStreamerId()).then(res => res.map(e => e.id))
      if (ids.some(id => !accessibleIds.includes(id))) {
        return builder.failure(404, 'One or more custom emojis could not be found.')
      }

      await this.customEmojiStore.updateCustomEmojiSortOrders(ids, sortOrders)
      return builder.success({ })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
