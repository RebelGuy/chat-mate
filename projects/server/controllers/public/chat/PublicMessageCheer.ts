import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicMessageCheer = PublicObject<{
  /** The name of the cheerer (?). */
  name: string

  /** The amount of bits cheered (?). */
  amount: number

  /** The URL to the cheer image (?). */
  imageUrl: string

  /** The hex colour of the cheer message (?). */
  colour: string
}>
