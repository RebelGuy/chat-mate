import ChannelStoreSuite from '@rebel/server/stores/ChannelStore.test'
import ChatStoreSuite from '@rebel/server/stores/ChatStore.test'
import LivestreamStoreSuite from '@rebel/server/stores/LivestreamStore.test'
import ExperienceStoreSuite from '@rebel/server/stores/ExperienceStore.test'
import ViewershipStoreSuite from '@rebel/server/stores/ViewershipStore.test'
import CustomEmojiStoreSuite from '@rebel/server/stores/CustomEmojiStore.test'
import FollowerStoreSuite from '@rebel/server/stores/FollowerStore.test'
import PunishmentStoreSuite from '@rebel/server/stores/PunishmentStore.test'

// keep an eye on this one: https://github.com/prisma/prisma/issues/732
// it would HUGELY improve efficiency if we can use an in-memory mock database for testing.

// these pesky little things. CHAT-78
jest.setTimeout(30000)

describe('ChannelStore Suite', ChannelStoreSuite)

describe('ChatStore Suite', ChatStoreSuite)

describe('CustomEmoji Suite', CustomEmojiStoreSuite)

describe('ExperienceStore Suite', ExperienceStoreSuite)

describe('FollowerStore Suite', FollowerStoreSuite)

describe('LivestreamStore Suite', LivestreamStoreSuite)

describe('PunishmentStore Suite', PunishmentStoreSuite)

describe('ViewershipStore Suite', ViewershipStoreSuite)
