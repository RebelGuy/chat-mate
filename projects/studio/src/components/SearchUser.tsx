import { PublicUserSearchResult } from '@rebel/server/controllers/public/user/PublicUserSearchResult'
import { group, sortBy } from '@rebel/shared/util/arrays'
import { searchRegisteredUser, searchUser } from '@rebel/studio/utility/api'
import ApiRequest from '@rebel/studio/components/ApiRequest'
import * as React from 'react'
import { Button, TextField } from '@mui/material'
import { Box } from '@mui/system'
import { SearchUserResponse } from '@rebel/server/controllers/UserController'
import { useCallback, useState } from 'react'
import useRequest from '@rebel/studio/hooks/useRequest'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'
import useDebounce from '@rebel/studio/hooks/useDebounce'

type Props = {
  greyOutDefaultUsers: boolean
  onPickResult: (result: PublicUserSearchResult) => void
}

type State = {
  currentInput: string
  searchTerm: string
  requestId: number
  hideResultsForRequestId: number
  forceRequestId: number
  hoveringPrimaryUserId: number
}

export default function SearchUser (props: Props) {
  const [currentInput, setCurrentInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [requestId, setRequestId] = useState(0)
  const [hideResultsForRequestId, setHideResultsForRequestId] = useState(0)
  const [forceRequestId, setForceRequestId] = useState(0)
  const [hoveringPrimaryUserId, setHoveringPrimaryUserId] = useState(-1)

  const searchUserRequest = useRequest(searchUser({ searchTerm }), {
    updateKey: searchTerm + forceRequestId,
    onRequest: () => searchTerm === '',
    onSuccess: () => setRequestId(id => id + 1)
  })
  const searchRegisteredUserRequest = useRequest(searchRegisteredUser({ searchTerm }), {
    updateKey: searchTerm + forceRequestId,
    onRequest: () => searchTerm === '',
    onSuccess: () => setRequestId(id => id + 1)
  })

  const onSetSearchString = useDebounce((searchString: string) => {
    setSearchTerm(searchString)
  }, 1000)

  const onChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentInput(e.target.value)
    onSetSearchString(e.target.value)
  }

  const onPickResult = (result: PublicUserSearchResult) => {
    setHideResultsForRequestId(requestId)
    props.onPickResult(result)
  }

  const onForceSearch = () => {
    setForceRequestId(id => id + 1)
  }

  return <div style={{ marginBottom: 16 }}>
    <Box>
      <TextField
        label="Channel or registered user"
        value={currentInput}
        onChange={onChangeInput}
        sx={{ display: 'block' }}
      />
      <Button onClick={onForceSearch} sx={{ mt: 1 }}>Search</Button>
    </Box>
    <div onMouseLeave={() => setHoveringPrimaryUserId(-1)}>
      <Box sx={{ mt: 2 }}>
        {searchTerm === '' || searchUserRequest.data?.results.length === 0 && searchRegisteredUserRequest.data?.results.length === 0
          ?
          <div>No users found</div>
          :
          searchUserRequest.isLoading || searchRegisteredUserRequest.isLoading || searchUserRequest.data == null || searchRegisteredUserRequest.data == null || hideResultsForRequestId === requestId
            ?
            null
            :
            sortBy(
              // the two results may have overlap
              group([...searchUserRequest.data.results, ...searchRegisteredUserRequest.data.results], x => x.user.primaryUserId),
              x => x.items[0].user.levelInfo.level + x.items[0].user.levelInfo.levelProgress + (x.items[0].user.registeredUser != null ? 100 : 0), // display registered users at the top
              'desc'
            ).map(({ group: _, items }, i) => (
              <UserItem
                key={i}
                matchResult={items[0]}
                greyOutDefaultUsers={props.greyOutDefaultUsers}
                isHovering={hoveringPrimaryUserId === items[0].user.primaryUserId}
                onSelect={() => onPickResult(items[0])}
                onHover={() => setHoveringPrimaryUserId(items[0].user.primaryUserId)}
              />
            ))
        }

        <ApiLoading requestObj={[searchUserRequest, searchRegisteredUserRequest]} />
        <ApiError requestObj={[searchUserRequest, searchRegisteredUserRequest]} />
      </Box>
    </div>
  </div>
}

type UserItemProps = {
  matchResult: PublicUserSearchResult
  greyOutDefaultUsers: boolean
  isHovering: boolean
  onSelect: () => void
  onHover: () => void
}

function UserItem (props: UserItemProps) {
  const { user, matchedChannel, allChannels } = props.matchResult
  if (user.registeredUser == null) {
    // `matchedChannel` is always defined for default user results
    return (
      <div
        key={user.primaryUserId}
        style={{
          cursor: 'pointer',color: props.greyOutDefaultUsers ? 'grey' : undefined, background: props.isHovering ? 'rgba(0, 0, 0, 0.2)' : undefined }}
        onClick={props.onSelect}
        onMouseEnter={props.onHover}
      >
        [{matchedChannel!.platform === 'youtube' ? 'YT' : 'TW'}] {matchedChannel!.displayName}
      </div>
    )
  }

  const youtubeChannels = allChannels.filter(c => c.platform === 'youtube').length
  const twitchChannels = allChannels.filter(c => c.platform === 'twitch').length
  return (
    <div
      key={user.primaryUserId}
      style={{
        cursor: 'pointer',
        background: props.isHovering ? 'rgba(0, 0, 0, 0.2)' : undefined
      }}
      onClick={props.onSelect}
      onMouseEnter={props.onHover}
    >
      {user.registeredUser.displayName} ({youtubeChannels} YT and {twitchChannels} TW)
    </div>
  )
}
