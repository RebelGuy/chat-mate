import { PublicUserSearchResult } from '@rebel/server/controllers/public/user/PublicUserSearchResult'
import LinkUser from '@rebel/studio/pages/link/LinkUser'
import SearchUser from '@rebel/studio/components/SearchUser'
import * as React from 'react'

export default function AdminLink () {
  const [selectedSearchResult, setSelectedSearchResult] = React.useState<PublicUserSearchResult | null>(null)

  const primaryUserId = selectedSearchResult?.user?.primaryUserId
  const primaryUserType = selectedSearchResult?.user?.registeredUser != null ? 'aggregate' : 'default'
  const aggregateUserId = primaryUserType === 'aggregate' ? primaryUserId : undefined
  const defaultUserId = primaryUserType === 'default' ? primaryUserId : selectedSearchResult?.matchedChannel?.defaultUserId
  return <>
    <h3>Admin</h3>
    <div>Manage links of a user. Currently selected: {primaryUserId ? `${selectedSearchResult!.matchedChannel?.displayName ?? selectedSearchResult!.user.registeredUser?.displayName ?? '<unknown>'}. Primary User ${primaryUserId} (${primaryUserType})`: 'n/a'}</div>

    <SearchUser greyOutDefaultUsers onPickResult={setSelectedSearchResult} />

    {primaryUserId != null && <>
      <h4>Link Results</h4>
      <LinkUser admin_selectedAggregateUserId={aggregateUserId} admin_selectedDefaultUserId={defaultUserId} />
    </>}
  </>
}
