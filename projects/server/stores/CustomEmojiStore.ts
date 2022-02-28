import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { Entity, New } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class CustomEmojiStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
  }

  public async getAllCustomEmojis (): Promise<Entity.CustomEmoji[]> {
    return await this.db.customEmoji.findMany()
  }

  /** Returns the created CustomEmoji. */
  public async addCustomEmoji (data: New<Entity.CustomEmoji>): Promise<Entity.CustomEmoji> {
    return await this.db.customEmoji.create({ data: {
      name: data.name,
      symbol: data.symbol,
      image: data.image,
      levelRequirement: data.levelRequirement
    }})
  }

  /** Returns the updated CustomEmoji. */
  public async updateCustomEmoji (data: Entity.CustomEmoji): Promise<Entity.CustomEmoji> {
    return await this.db.customEmoji.update({
      where: { id: data.id },
      data: {
        name: data.name,
        symbol: data.symbol,
        image: data.image,
        levelRequirement: data.levelRequirement
      }
    })
  }
}
