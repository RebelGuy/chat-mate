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

// re-enable if CHAT-78 is done
const describeFn = process.env.CI === 'true' ? describe.skip : describe

describeFn('ChannelStore Suite', ChannelStoreSuite)

describeFn('ChatStore Suite', ChatStoreSuite)

describeFn('CustomEmoji Suite', CustomEmojiStoreSuite)

describeFn('ExperienceStore Suite', ExperienceStoreSuite)

describeFn('FollowerStore Suite', FollowerStoreSuite)

describeFn('LivestreamStore Suite', LivestreamStoreSuite)

describeFn('PunishmentStore Suite', PunishmentStoreSuite)

describeFn('ViewershipStore Suite', ViewershipStoreSuite)
