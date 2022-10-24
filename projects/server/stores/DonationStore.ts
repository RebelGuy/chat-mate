import { ChatCustomEmoji, ChatMessage, ChatMessagePart, ChatText, CustomEmojiVersion, Donation } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { ChatItemWithRelations, PartialChatMessage } from '@rebel/server/models/chat'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import ChatStore, { chatMessageIncludeRelations, createChatMessagePart } from '@rebel/server/stores/ChatStore'
import { Singular } from '@rebel/server/types'
import { single } from '@rebel/server/util/arrays'
import { DonationUserLinkAlreadyExistsError, DonationUserLinkNotFoundError } from '@rebel/server/util/error'
import { assertUnreachable } from '@rebel/server/util/typescript'

export type DonationWithMessage = Omit<Donation, 'chatMessageId'> & {
  messageParts: ChatItemWithRelations['chatMessageParts']
}

export type DonationWithUser = DonationWithMessage & {
  linkIdentifier: string
  linkedAt: Date | null
  userId: number | null
}

export type DonationCreateArgs = {
  streamlabsId: number
  streamlabsUserId: number | null
  time: Date
  currency: string
  amount: number
  formattedAmount: string
  name: string
  messageParts: PartialChatMessage[]
}

const INTERNAL_USER_PREFIX = 'internal-'

const EXTERNAL_USER_PREFIX = 'external-'

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class DonationStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
  }

  public async addDonation (data: DonationCreateArgs): Promise<void> {
    await this.db.$transaction(async db => {
      let chatMessage: ChatMessage | undefined = undefined
      if (data.messageParts.length > 0) {
        chatMessage = await this.db.chatMessage.create({ data: {
          externalId: `${data.streamlabsId}`,
          time: data.time
        }})

        await Promise.all(data.messageParts.map((part, i) =>
          db.chatMessagePart.create({ data: createChatMessagePart(part, i, chatMessage!.id) })
        ))
      }

      await this.db.donation.create({ data: {
        streamlabsId: data.streamlabsId,
        streamlabsUserId: data.streamlabsUserId ?? null,
        amount: data.amount,
        formattedAmount: data.formattedAmount,
        currency: data.currency,
        name: data.name,
        time: data.time,
        chatMessageId: chatMessage?.id ?? null
      }})
    })
  }

  /** Returns donations that have been linked to the user, orderd by time in ascending order. */
  public async getDonationsByUserId (userId: number): Promise<Donation[]> {
    const donationLink = await this.db.donationLink.findMany({ where: { linkedUserId: userId }})
    const linkIdentifiers = donationLink.map(u => u.linkIdentifier)
    const donationIds = linkIdentifiers.filter(id => id.startsWith(INTERNAL_USER_PREFIX)).map(id => Number(id.substring(INTERNAL_USER_PREFIX.length)))
    const streamlabsUserIds = linkIdentifiers.filter(id => id.startsWith(EXTERNAL_USER_PREFIX)).map(id => Number(id.substring(EXTERNAL_USER_PREFIX.length)))

    return await this.db.donation.findMany({
      where: {
        OR: [
          { id: { in: donationIds } },
          { streamlabsUserId: { in: streamlabsUserIds }}
        ]
      },
      orderBy: { time: 'asc' }
    })
  }

  public async getDonation (donationId: number): Promise<DonationWithUser> {
    const donation = await this.db.donation.findUnique({
      where: { id: donationId },
      rejectOnNotFound: true,
      include: { chatMessage: {
        // hehe
        include: { chatMessageParts: chatMessageIncludeRelations.chatMessageParts }
      }}
    })

    const linkIdentifier = await this.getLinkIdentifier(donationId)
    const donationLink = await this.db.donationLink.findUnique({
      where: { linkIdentifier: linkIdentifier },
      rejectOnNotFound: false
    })

    return {
      id: donation.id,
      amount: donation.amount,
      currency: donation.currency,
      formattedAmount: donation.formattedAmount,
      name: donation.name,
      streamlabsId: donation.streamlabsId,
      time: donation.time,
      streamlabsUserId: donation.streamlabsUserId,
      messageParts: donation.chatMessage?.chatMessageParts ?? [],
      linkIdentifier: linkIdentifier,
      userId: donationLink?.linkedUserId ?? null,
      linkedAt: donationLink?.linkedAt ?? null
    }
  }

  /** Returns donations after the given time, ordered by time in ascending order. */
  public async getDonationsSince (time: number): Promise<DonationWithUser[]> {
    const donations = await this.db.donation.findMany({
      where: { time: { gt: new Date(time) }},
      orderBy: { time: 'asc' },
      include: { chatMessage: {
        include: { chatMessageParts: chatMessageIncludeRelations.chatMessageParts }
      }}
    })

    const linkIdentifiers = await this.getLinkIdentifiers(donations.map(d => d.id))
    const donationLinks = await this.db.donationLink.findMany({
      where: { linkIdentifier: { in: linkIdentifiers.map(ids => ids[1]) }}
    })

    return donations.map(donation => {
      const linkIdentifier = linkIdentifiers.find(s => s[0] === donation.id)![1]
      const donationLink = donationLinks.find(u => u.linkIdentifier === linkIdentifier)
      return {
        id: donation.id,
        amount: donation.amount,
        currency: donation.currency,
        formattedAmount: donation.formattedAmount,
        name: donation.name,
        streamlabsId: donation.streamlabsId,
        time: donation.time,
        streamlabsUserId: donation.streamlabsUserId,
        messageParts: donation.chatMessage?.chatMessageParts ?? [],
        linkIdentifier: linkIdentifier,
        userId: donationLink?.linkedUserId ?? null,
        linkedAt: donationLink?.linkedAt ?? null
      }
    })
  }

  /** Returns the highest Streamlabs donation ID contained in the database. */
  public async getLastStreamlabsId (): Promise<number | null> {
    const result = await this.db.donation.findFirst({
      select: { streamlabsId: true },
      orderBy: { streamlabsId: 'desc' },
      take: 1
    })

    return result?.streamlabsId ?? null
  }

  // we perform side effects when linking/unlinking, which is why we separated the remove/add functionality into two methods
  // instead of just discarding the existing link.

  // an internal detail is that ChatMate users are no longer matchd to the donations directly, but rather we construct a streamlabs user
  // (either using the actual streamlabs user id, or by deterministically constructing a synthetic id that is unique to this donation)
  // and link the ChatMate user to that streamlabs user instead.

  /** Links the user to the donation.
   * @throws {@link DonationUserLinkAlreadyExistsError}: When a link already exists for the donation. */
  public async linkUserToDonation (donationId: number, userId: number, linkedAt: Date): Promise<void> {
    const linkIdentifier = await this.getLinkIdentifier(donationId)

    const existingLink = await this.db.donationLink.findFirst({ where: { linkIdentifier }})
    if (existingLink != null) {
      throw new DonationUserLinkAlreadyExistsError()
    }

    await this.db.donationLink.create({ data: {
      linkIdentifier: linkIdentifier,
      linkedUserId: userId,
      linkedAt: linkedAt
    }})
  }

  /** Returns the userId that was unlinked.
   * @throws {@link DonationUserLinkNotFoundError}: When a link does not exist for the donation. */
  public async unlinkUserFromDonation (donationId: number): Promise<number> {
    const linkIdentifier = await this.getLinkIdentifier(donationId)

    const existingLink = await this.db.donationLink.findFirst({ where: { linkIdentifier }})
    if (existingLink == null) {
      throw new DonationUserLinkNotFoundError()
    }

    await this.db.donationLink.delete({
      where: { id: existingLink.id }
    })
    return existingLink.linkedUserId
  }

  private async getLinkIdentifier (donationId: number): Promise<string> {
    return single(await this.getLinkIdentifiers([donationId]))[1]
  }

  /** Returns the donationId-linkIdentifier pairs. */
  private async getLinkIdentifiers (donationIds: number[]): Promise<[number, string][]> {
    const donations = await this.db.donation.findMany({
      where: { id: { in: donationIds }}
    })

    return donations.map(donation => {
      return [donation.id, donation.streamlabsUserId == null ? `${INTERNAL_USER_PREFIX}${donation.id}` : `${EXTERNAL_USER_PREFIX}${donation.streamlabsUserId}`]
    })
  }
}
