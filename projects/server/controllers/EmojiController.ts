import { ControllerDependencies, buildPath, ControllerBase } from '@rebel/server/controllers/ControllerBase'
import { requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { customEmojiToPublicObject, publicObjectToCustomEmojiUpdateData, publicObjectNewToNewCustomEmoji } from '@rebel/server/models/emoji'
import { Path, GET, POST, PATCH, PreProcessor, BodyOptions, DELETE, QueryParam } from 'typescript-rest'
import { AddCustomEmojiRequest, AddCustomEmojiResponse, DeleteCustomEmojiResponse, GetCustomEmojisResponse, UpdateCustomEmojiRequest, UpdateCustomEmojiResponse, UpdateCustomEmojiSortOrderRequest, UpdateCustomEmojiSortOrderResponse } from '@rebel/api-models/schema/emoji'
import CustomEmojiService from '@rebel/server/services/CustomEmojiService'
import CustomEmojiStore from '@rebel/server/stores/CustomEmojiStore'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { nonEmptyStringValidator } from '@rebel/server/controllers/validation'

type Deps = ControllerDependencies<{
  customEmojiStore: CustomEmojiStore
  customEmojiService: CustomEmojiService
}>

@Path(buildPath('emoji'))
@PreProcessor(requireStreamer)
export default class EmojiController extends ControllerBase {
  private readonly customEmojiStore: CustomEmojiStore
  private readonly customEmojiService: CustomEmojiService

  constructor (deps: Deps) {
    super(deps, 'emoji')
    this.customEmojiStore = deps.resolve('customEmojiStore')
    this.customEmojiService = deps.resolve('customEmojiService')
  }

  @GET
  @Path('/custom')
  public async getCustomEmojis (): Promise<GetCustomEmojisResponse> {
    const builder = this.registerResponseBuilder<GetCustomEmojisResponse>('GET /custom')
    try {
      const emojis = await this.customEmojiService.getAllCustomEmojis(this.getStreamerId())
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

    const validationError = builder.validateInput({
      newEmoji: {
        type: 'object',
        body: {
          name: { type: 'string' },
          symbol: {
            type: 'string',
            validators: [
              { onValidate: (s: string) => s.length < 1 || s.length > 32, errorMessage: 'Symbol must be between 1 and 32 characters' },
              { onValidate: (s: string) => s.includes(':'), errorMessage: `Symbol cannot include the character ':'` }
            ]
          },
          levelRequirement: { type: 'number' },
          canUseInDonationMessage: { type: 'boolean' },
          whitelistedRanks: { type: 'number', isArray: true },
          sortOrder: { type: 'number' },
          imageDataUrl: {
            type: 'string',
            validators: [
              nonEmptyStringValidator,
              { onValidate: (s: string) => s.toLowerCase().startsWith('http'), errorMessage: 'Image cannot be a HTTP URL' }
            ]
          }
        }
      },
      insertAtBeginning: { type: 'boolean', optional: true }
    }, request)

    if (validationError != null) {
      return validationError
    }

    try {
      const streamerId = this.getStreamerId()
      let emoji = await this.customEmojiService.addCustomEmoji(publicObjectNewToNewCustomEmoji(request.newEmoji, streamerId))

      if (request.insertAtBeginning === true) {
        emoji.sortOrder = await this.customEmojiService.setFirstInSortOrder(streamerId, emoji.id)
      }

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

    const validationError = builder.validateInput({
      updatedEmoji: {
        type: 'object',
        body: {
          id: { type: 'number' },
          name: { type: 'string' },
          levelRequirement: { type: 'number' },
          canUseInDonationMessage: { type: 'boolean' },
          whitelistedRanks: { type: 'number', isArray: true },
          sortOrder: { type: 'number' },
          imageDataUrl: {
            type: 'string',
            validators: [
              nonEmptyStringValidator,
              { onValidate: (s: string) => s.toLowerCase().startsWith('http'), errorMessage: 'Image cannot be a HTTP URL' }
            ]
          }
        }
      }
    }, request)

    if (validationError != null) {
      return validationError
    }

    try {
      const existingEmoji = await this.customEmojiStore.getCustomEmojiById(request.updatedEmoji.id)
      if (existingEmoji == null || existingEmoji.streamerId !== this.getStreamerId()) {
        return builder.failure(404, 'Could not find emoji with the given ID')
      }

      const emoji = await this.customEmojiService.updateCustomEmoji(publicObjectToCustomEmojiUpdateData(request.updatedEmoji), false)
      return builder.success({ updatedEmoji: customEmojiToPublicObject(emoji) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @DELETE
  @Path('/custom')
  @PreProcessor(requireRank('owner'))
  public async deleteCustomEmoji (@QueryParam('id') id: number): Promise<DeleteCustomEmojiResponse> {
    const builder = this.registerResponseBuilder<DeleteCustomEmojiResponse>('DELETE /custom')

    const validationError = builder.validateInput({ id: { type: 'number' }}, { id })
    if (validationError != null) {
      return validationError
    }

    try {
      const existingEmoji = await this.customEmojiStore.getCustomEmojiById(id)
      if (existingEmoji == null || existingEmoji.streamerId !== this.getStreamerId()) {
        return builder.failure(404, 'Could not find emoji with the given ID')
      }

      await this.customEmojiStore.deactivateCustomEmoji(id)
      return builder.success({ })
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
      const sortOrders = Object.values(request.sortOrders).map(sortOrder => Number(sortOrder))
      const validationError = builder.validateInput({
        ids: { type: 'number', isArray: true },
        sortOrders: { type: 'number', isArray: true },
      }, { ids, sortOrders })

      if (validationError != null) {
        return validationError
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
