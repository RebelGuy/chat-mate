import { ControllerDependencies, buildPath, ControllerBase, ApiResponse, ApiRequest, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicCustomEmoji, PublicCustomEmojiNew } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { customEmojiToPublicObject, publicObjectToCustomEmoji as publicObjectToCustomEmojiUpdateData, publicObjectNewToNewCustomEmoji as publicObjectNewToCustomEmojiCreateData } from '@rebel/server/models/emoji'
import CustomEmojiStore from '@rebel/server/stores/CustomEmojiStore'
import { Path, GET, POST, PATCH } from 'typescript-rest'

export type GetCustomEmojisResponse = ApiResponse<1, { emojis: Tagged<1, PublicCustomEmoji>[] }>

export type AddCustomEmojiRequest = ApiRequest<1, { schema: 1, newEmoji: Tagged<1, PublicCustomEmojiNew> }>
export type AddCustomEmojiResponse = ApiResponse<1, { newEmoji: Tagged<1, PublicCustomEmoji> }>

export type UpdateCustomEmojiRequest = ApiRequest<1, { schema: 1, updatedEmoji: Tagged<1, PublicCustomEmoji> }>
export type UpdateCustomEmojiResponse = ApiResponse<1, { updatedEmoji: Tagged<1, PublicCustomEmoji> }>

type Deps = ControllerDependencies<{
  customEmojiStore: CustomEmojiStore
}>

@Path(buildPath('emoji'))
export default class EmojiController extends ControllerBase {
  private readonly customEmojiStore: CustomEmojiStore

  constructor (deps: Deps) {
    super(deps, 'emoji')
    this.customEmojiStore = deps.resolve('customEmojiStore')
  }

  @GET
  @Path('/custom')
  public async getCustomEmojis (): Promise<GetCustomEmojisResponse> {
    const builder = this.registerResponseBuilder<GetCustomEmojisResponse>('GET /custom', 1)
    try {
      const emojis = await this.customEmojiStore.getAllCustomEmojis()
      return builder.success({ emojis: emojis.map(e => customEmojiToPublicObject(e)) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/custom')
  public async addCustomEmoji (request: AddCustomEmojiRequest): Promise<AddCustomEmojiResponse> {
    const builder = this.registerResponseBuilder<AddCustomEmojiResponse>('POST /custom', 1)
    if (request == null || request.schema !== builder.schema || request.newEmoji == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    const symbol = request.newEmoji.symbol ?? ''
    if (symbol.length < 3 || symbol.length > 10) {
      return builder.failure(400, 'Symbol must be between 3 and 10 characters.')
    }

    try {
      const emoji = await this.customEmojiStore.addCustomEmoji(publicObjectNewToCustomEmojiCreateData(request.newEmoji))
      return builder.success({ newEmoji: customEmojiToPublicObject(emoji) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @PATCH
  @Path('/custom')
  public async updateCustomEmoji (request: UpdateCustomEmojiRequest): Promise<UpdateCustomEmojiResponse> {
    const builder = this.registerResponseBuilder<UpdateCustomEmojiResponse>('PATCH /custom', 1)
    if (request == null || request.schema !== builder.schema) {
      return builder.failure(400, 'Invalid request data.')
    }

    const symbol = request.updatedEmoji.symbol ?? ''
    if (symbol.length < 3 || symbol.length > 10) {
      return builder.failure(400, 'Symbol must be between 3 and 10 characters.')
    }

    try {
      const emoji = await this.customEmojiStore.updateCustomEmoji(publicObjectToCustomEmojiUpdateData(request.updatedEmoji))
      return builder.success({ updatedEmoji: customEmojiToPublicObject(emoji) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
