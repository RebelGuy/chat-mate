import ChannelStoreSuite from '@rebel/server/stores/ChannelStore.test'
import ChatStoreSuite from '@rebel/server/stores/ChatStore.test'
import CommandStoreSuite from '@rebel/server/stores/CommandStore.test'
import LivestreamStoreSuite from '@rebel/server/stores/LivestreamStore.test'
import ExperienceStoreSuite from '@rebel/server/stores/ExperienceStore.test'
import ViewershipStoreSuite from '@rebel/server/stores/ViewershipStore.test'
import CustomEmojiStoreSuite from '@rebel/server/stores/CustomEmojiStore.test'
import FollowerStoreSuite from '@rebel/server/stores/FollowerStore.test'
import RankStoreSuite from '@rebel/server/stores/RankStore.test'
import DonationStoreSuite from '@rebel/server/stores/DonationStore.test'
import AccountStoreSuite from '@rebel/server/stores/AccountStore.test'
import StreamerStoreSuite from '@rebel/server/stores/StreamerStore.test'
import LinkStoreSuite from '@rebel/server/stores/LinkStore.test'

// keep an eye on this one: https://github.com/prisma/prisma/issues/732
// it would HUGELY improve efficiency if we can use an in-memory mock database for testing.

// re-enable if CHAT-78 is done
const describeFn = process.env.CI === 'true' ? describe.skip : describe

describeFn('AccountStore Suite', AccountStoreSuite)

describeFn('ChannelStore Suite', ChannelStoreSuite)

describeFn('ChatStore Suite', ChatStoreSuite)

describeFn('CommandStore Suite', CommandStoreSuite)

describeFn('CustomEmojiStore Suite', CustomEmojiStoreSuite)

describeFn('DonationStore Suite', DonationStoreSuite)

describeFn('ExperienceStore Suite', ExperienceStoreSuite)

describeFn('FollowerStore Suite', FollowerStoreSuite)

describeFn('LivestreamStore Suite', LivestreamStoreSuite)

describeFn('LinkStore Suite', LinkStoreSuite)

describeFn('RankStore Suite', RankStoreSuite)

describeFn('StreamerStore Suite', StreamerStoreSuite)

describeFn('ViewershipStore Suite', ViewershipStoreSuite)
