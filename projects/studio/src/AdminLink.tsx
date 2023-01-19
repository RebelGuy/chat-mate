import { PublicUserSearchResult } from '@rebel/server/controllers/public/user/PublicUserSearchResult'
import LinkUser from '@rebel/studio/LinkUser'
import SearchUser from '@rebel/studio/SearchUser'
import * as React from 'react'

export default function AdminLink () {
  const [selectedSearchResult, setSelectedSearchResult] = React.useState<Pick<PublicUserSearchResult, 'user' | 'allChannels'> | null>(null)

  const selectedUserId = selectedSearchResult?.user?.primaryUserId
  return <>
    <h3>Admin</h3>
    <div>Manage links of a user. Currently selected: {selectedUserId ? 'Primary User ' + selectedUserId : 'n/a'}</div>

    <SearchUser greyOutDefaultUsers onPickResult={setSelectedSearchResult} />

    {selectedUserId != null && <LinkUser admin_aggregateUserId={selectedUserId} />}
  </>
}
