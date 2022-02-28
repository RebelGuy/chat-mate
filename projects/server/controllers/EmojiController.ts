import { ControllerDependencies, buildPath, ControllerBase, ApiResponse, ApiRequest } from '@rebel/server/controllers/ControllerBase'
import { PublicCustomEmoji, PublicCustomEmojiNew } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { customEmojiToPublicObject, publicObjectToCustomEmoji, publicObjectNewToNewCustomEmoji } from '@rebel/server/models/emoji'
import CustomEmojiStore from '@rebel/server/stores/CustomEmojiStore'
import { Path, GET, POST, PATCH } from 'typescript-rest'

type GetCustomEmojisResponse = ApiResponse<1, { emojis: PublicCustomEmoji[] }>

type AddCustomEmojiRequest = ApiRequest<1, { schema: 1, newEmoji: PublicCustomEmojiNew }>
type AddCustomEmojiResponse = ApiResponse<1, { newEmoji: PublicCustomEmoji }>

type UpdateCustomEmojiRequest = ApiRequest<1, { schema: 1, updatedEmoji: PublicCustomEmoji }>
type UpdateCustomEmojiResponse = ApiResponse<1, { updatedEmoji: PublicCustomEmoji }>

type Deps = ControllerDependencies<{
  customEmojiStore: CustomEmojiStore
}>

@Path(buildPath('emoji'))
export default class ExperienceController extends ControllerBase {
  private readonly customEmojiStore: CustomEmojiStore

  constructor (deps: Deps) {
    super(deps, 'experience')
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
      return builder.failure(e.message)
    }
  }

  @POST
  @Path('/custom')
  public async addCustomEmoji (request: AddCustomEmojiRequest): Promise<AddCustomEmojiResponse> {
    const builder = this.registerResponseBuilder<AddCustomEmojiResponse>('POST /custom', 1)
    if (request == null || request.schema !== builder.schema) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const emoji = await this.customEmojiStore.addCustomEmoji(publicObjectNewToNewCustomEmoji(request.newEmoji))
      return builder.success({ newEmoji: customEmojiToPublicObject(emoji) })
    } catch (e: any) {
      return builder.failure(e.message)
    }
  }

  @PATCH
  @Path('/custom')
  public async updateCustomEmoji (request: UpdateCustomEmojiRequest): Promise<UpdateCustomEmojiResponse> {
    const builder = this.registerResponseBuilder<UpdateCustomEmojiResponse>('PATCH /custom', 1)
    if (request == null || request.schema !== builder.schema) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const emoji = await this.customEmojiStore.updateCustomEmoji(publicObjectToCustomEmoji(request.updatedEmoji))
      return builder.success({ updatedEmoji: customEmojiToPublicObject(emoji) })
    } catch (e: any) {
      return builder.failure(e.message)
    }
  }
}
