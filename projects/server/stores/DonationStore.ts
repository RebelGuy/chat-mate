import { ChatCustomEmoji, ChatMessage, ChatMessagePart, ChatText, CustomEmojiVersion, Donation, StreamlabsSocketToken } from '@prisma/client'
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
  primaryUserId: number | null
}

export type DonationCreateArgs = {
  streamlabsId: number
  streamlabsUserId: number | null
  streamerId: number
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
      const donation = await db.donation.create({ data: {
        streamlabsId: data.streamlabsId,
        streamlabsUserId: data.streamlabsUserId ?? null,
        streamerId: data.streamerId,
        amount: data.amount,
        formattedAmount: data.formattedAmount,
        currency: data.currency,
        name: data.name,
        time: data.time
      }})

      if (data.messageParts.length > 0) {
        const chatMessage = await db.chatMessage.create({ data: {
          streamerId: data.streamerId,
          externalId: `${data.streamlabsId}`,
          time: data.time,
          donationId: donation.id
        }})

        await Promise.all(data.messageParts.map((part, i) =>
          db.chatMessagePart.create({ data: createChatMessagePart(part, i, chatMessage.id) })
        ))
      }
    })
  }

  /** Returns donations that have been linked to any of the given exact users, orderd by time in ascending order. Does not take into account the user connections - exact userIds must be provided.
   * If `streamerId` is `null`, returns donations across all streamers. */
  public async getDonationsByUserIds (streamerId: number | null, exactUserIds: number[]): Promise<Donation[]> {
    const donationLinks = await this.db.donationLink.findMany({
      where: { linkedUserId: { in: exactUserIds }}
    })
    const linkIdentifiers = donationLinks.map(u => u.linkIdentifier)
    const donationIds = linkIdentifiers.filter(id => id.startsWith(INTERNAL_USER_PREFIX)).map(id => Number(id.substring(INTERNAL_USER_PREFIX.length)))
    const streamlabsUserIds = linkIdentifiers.filter(id => id.startsWith(EXTERNAL_USER_PREFIX)).map(id => Number(id.substring(EXTERNAL_USER_PREFIX.length)))

    return await this.db.donation.findMany({
      where: {
        streamerId: streamerId ?? undefined,
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
      streamerId: donation.streamerId,
      amount: donation.amount,
      currency: donation.currency,
      formattedAmount: donation.formattedAmount,
      name: donation.name,
      streamlabsId: donation.streamlabsId,
      time: donation.time,
      streamlabsUserId: donation.streamlabsUserId,
      messageParts: donation.chatMessage?.chatMessageParts ?? [],
      linkIdentifier: linkIdentifier,
      primaryUserId: donationLink?.linkedUserId ?? null,
      linkedAt: donationLink?.linkedAt ?? null
    }
  }

  /** Returns donations after the given time, ordered by time in ascending order. */
  public async getDonationsSince (streamerId: number, time: number): Promise<DonationWithUser[]> {
    const donations = await this.db.donation.findMany({
      where: {
        streamerId: streamerId,
        time: { gt: new Date(time) }
      },
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
        streamerId: donation.streamerId,
        amount: donation.amount,
        currency: donation.currency,
        formattedAmount: donation.formattedAmount,
        name: donation.name,
        streamlabsId: donation.streamlabsId,
        time: donation.time,
        streamlabsUserId: donation.streamlabsUserId,
        messageParts: donation.chatMessage?.chatMessageParts ?? [],
        linkIdentifier: linkIdentifier,
        primaryUserId: donationLink?.linkedUserId ?? null,
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

  public async getStreamlabsSocketToken (streamerId: number): Promise<StreamlabsSocketToken | null> {
    return await this.db.streamlabsSocketToken.findFirst({ where: { streamerId }})
  }

  // we perform side effects when linking/unlinking, which is why we separated the remove/add functionality into two methods
  // instead of just discarding the existing link.

  // an internal detail is that ChatMate users are no longer matched to the donations directly, but rather we construct a link identifier
  // (either using the actual streamlabs user id, or by deterministically constructing a synthetic id that is unique to this donation)
  // and link the ChatMate user to that link identifier instead.

  /** Links the user to the donation. It is the responsibility of the caller to ensure the correct primary user is used.
   * @throws {@link DonationUserLinkAlreadyExistsError}: When a link already exists for the donation. */
  public async linkUserToDonation (donationId: number, primaryUserId: number, linkedAt: Date): Promise<void> {
    const linkIdentifier = await this.getLinkIdentifier(donationId)

    const existingLink = await this.db.donationLink.findFirst({ where: { linkIdentifier }})
    if (existingLink != null) {
      throw new DonationUserLinkAlreadyExistsError()
    }

    await this.db.donationLink.create({ data: {
      linkIdentifier: linkIdentifier,
      linkedUserId: primaryUserId,
      linkedAt: linkedAt
    }})
  }

  /** Updates donation links such that donations originally linked to `fromUserId` now point to `toUserId`. */
  public async relinkDonation (fromUserId: number, toUserId: number) {
    await this.db.donationLink.updateMany({
      where: { linkedUserId: fromUserId },
      data: {
        linkedUserId: toUserId,
        originalLinkedUserId: fromUserId
      }
    })
  }

  /** Returns true if the socket token has been updated, and false if the provided socket token is the same as the existing token. */
  public async setStreamlabsSocketToken (streamerId: number, streamlabsSocketToken: string | null): Promise<boolean> {
    const existingEntry = await this.db.streamlabsSocketToken.findFirst({ where: { streamerId }})

    if (streamlabsSocketToken != null) {
      if (existingEntry != null && existingEntry.token === streamlabsSocketToken) {
        return false
      } else if (existingEntry != null && existingEntry.token !== streamlabsSocketToken) {
        throw new Error('An existing token is already active. Please first deactivate the active token, then set the new one.')
      } else {
        await this.db.streamlabsSocketToken.upsert({
          create: { streamerId, token: streamlabsSocketToken },
          update: { token: streamlabsSocketToken },
          where: { streamerId }
        })
        return true
      }

    } else {
      if (existingEntry == null) {
        return false
      } else {
        await this.db.streamlabsSocketToken.delete({where: { streamerId }})
        return true
      }
    }
  }

  /** Updates donation links that originally pointed to `originalUserId` to now point to that user again. */
  public async undoDonationRelink (originalUserId: number) {
    await this.db.donationLink.updateMany({
      where: { originalLinkedUserId: originalUserId },
      data: {
        originalLinkedUserId: null,
        linkedUserId: originalUserId
      }
    })
  }

  /** Returns the primaryUserId that was unlinked.
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
