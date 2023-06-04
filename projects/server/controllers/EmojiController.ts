import { ControllerDependencies, buildPath, ControllerBase, ApiResponse, ApiRequest, PublicObject } from '@rebel/server/controllers/ControllerBase'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { PublicCustomEmoji, PublicCustomEmojiNew, PublicCustomEmojiUpdate } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { customEmojiToPublicObject, publicObjectToCustomEmojiUpdateData, publicObjectNewToNewCustomEmoji } from '@rebel/server/models/emoji'
import CustomEmojiStore from '@rebel/server/stores/CustomEmojiStore'
import { Path, GET, POST, PATCH, PreProcessor } from 'typescript-rest'

export type GetCustomEmojisResponse = ApiResponse<{ emojis: PublicObject<PublicCustomEmoji>[] }>

export type AddCustomEmojiRequest = ApiRequest<{ newEmoji: PublicObject<PublicCustomEmojiNew> }>
export type AddCustomEmojiResponse = ApiResponse<{ newEmoji: PublicObject<PublicCustomEmoji> }>

export type UpdateCustomEmojiRequest = ApiRequest<{ updatedEmoji: PublicObject<PublicCustomEmojiUpdate> }>
export type UpdateCustomEmojiResponse = ApiResponse<{ updatedEmoji: PublicObject<PublicCustomEmoji> }>

type Deps = ControllerDependencies<{
  customEmojiStore: CustomEmojiStore
}>

@Path(buildPath('emoji'))
@PreProcessor(requireStreamer)
export default class EmojiController extends ControllerBase {
  private readonly customEmojiStore: CustomEmojiStore

  constructor (deps: Deps) {
    super(deps, 'emoji')
    this.customEmojiStore = deps.resolve('customEmojiStore')
  }

  @GET
  @Path('/custom')
  public async getCustomEmojis (): Promise<GetCustomEmojisResponse> {
    const builder = this.registerResponseBuilder<GetCustomEmojisResponse>('GET /custom')
    try {
      const emojis = await this.customEmojiStore.getAllCustomEmojis(this.getStreamerId())
      return builder.success({ emojis: emojis.map(e => customEmojiToPublicObject(e)) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/custom')
  @PreProcessor(requireRank('owner'))
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

    const imageData = request.newEmoji.imageData ?? ''
    if (imageData.length === 0) {
      return builder.failure(400, 'Image data must be defined')
    }

    try {
      const emoji = await this.customEmojiStore.addCustomEmoji(publicObjectNewToNewCustomEmoji(request.newEmoji, this.getStreamerId()))
      return builder.success({ newEmoji: customEmojiToPublicObject(emoji) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @PATCH
  @Path('/custom')
  @PreProcessor(requireRank('owner'))
  public async updateCustomEmoji (request: UpdateCustomEmojiRequest): Promise<UpdateCustomEmojiResponse> {
    const builder = this.registerResponseBuilder<UpdateCustomEmojiResponse>('PATCH /custom')
    if (request == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    const imageData = request.updatedEmoji.imageData ?? ''
    if (imageData.length === 0) {
      return builder.failure(400, 'Image data must be defined')
    }

    try {
      const emoji = await this.customEmojiStore.updateCustomEmoji(publicObjectToCustomEmojiUpdateData(request.updatedEmoji))
      return builder.success({ updatedEmoji: customEmojiToPublicObject(emoji) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
