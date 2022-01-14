import ChannelStoreSuite from '@rebel/server/stores/ChannelStore.test'
import ChatStoreSuite from '@rebel/server/stores/ChatStore.test'
import LivestreamStoreSuite from '@rebel/server/stores/LivestreamStore.test'
import ExperienceStoreSuite from '@rebel/server/stores/ExperienceStore.test'
import ViewershipStoreSuite from '@rebel/server/stores/ViewershipStore.test'

// keep an eye on this one: https://github.com/prisma/prisma/issues/732
// it would HUGELY improve efficiency if we can use an in-memory mock database for testing.

describe('ChannelStore Suite', ChannelStoreSuite)

describe('ChatStore Suite', ChatStoreSuite)

describe('LivestreamStore Suite', LivestreamStoreSuite)

describe('ExperienceStore Suite', ExperienceStoreSuite)

describe('ViewershipStore Suite', ViewershipStoreSuite)
