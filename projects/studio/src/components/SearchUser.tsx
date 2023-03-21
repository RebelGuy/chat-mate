import { PublicUserSearchResult } from '@rebel/server/controllers/public/user/PublicUserSearchResult'
import { group, sortBy } from '@rebel/shared/util/arrays'
import { searchRegisteredUser, searchUser } from '@rebel/studio/utility/api'
import ApiRequest from '@rebel/studio/components/ApiRequest'
import * as React from 'react'
import { Button, TextField } from '@mui/material'
import { Box } from '@mui/system'
import { SearchUserResponse } from '@rebel/server/controllers/UserController'

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

export default class SearchUser extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props)

    this.state = {
      currentInput: '',
      searchTerm: '',
      requestId: 0,
      hideResultsForRequestId: 0,
      forceRequestId: 0,
      hoveringPrimaryUserId: -1
    }
  }

  onSetSearchString = debounce((searchString: string) => {
    this.setState({ searchTerm: searchString })
  }, 1000)

  onChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ currentInput: e.target.value })
    this.onSetSearchString(e.target.value)
  }

  onRequestChannelSearch = async (loginToken: string, streamer: string) => {
    let result: SearchUserResponse
    if (this.state.searchTerm === '') {
      result = {
        success: true,
        timestamp: Date.now(),
        data: { results: [] }
      }
    } else {
      result = await searchUser(loginToken, streamer, this.state.searchTerm)
    }
    this.setState({ requestId: this.state.requestId + 1 })
    return result
  }

  onRequestRegisteredSearch = async (loginToken: string, streamer: string) => {
    let result: SearchUserResponse
    if (this.state.searchTerm === '') {
      result = {
        success: true,
        timestamp: Date.now(),
        data: { results: [] }
      }
    } else {
      result = await searchRegisteredUser(loginToken, streamer, this.state.searchTerm)
    }
    this.setState({ requestId: this.state.requestId + 1 })
    return result
  }

  onPickResult = (result: PublicUserSearchResult) => {
    this.setState({ hideResultsForRequestId: this.state.requestId })
    this.props.onPickResult(result)
  }

  onForceSearch = () => {
    this.setState({ forceRequestId: this.state.forceRequestId + 1 })
  }

  override render (): React.ReactNode {
    // result1: channel search
    // result2: registered user search

    // The two results may have overlap

    return <div style={{ marginBottom: 16 }}>
      <Box>
        <TextField
          label="Channel or registered user"
          value={this.state.currentInput}
          onChange={this.onChangeInput}
          sx={{ display: 'block' }}
        />
        <Button onClick={this.onForceSearch} sx={{ mt: 1 }}>Search</Button>
      </Box>
      <div onMouseLeave={() => this.setState({ hoveringPrimaryUserId: -1 })}>
        <ApiRequest onDemand token={this.state.searchTerm + this.state.forceRequestId} requiresStreamer onRequest={this.onRequestChannelSearch}>
          {(result1, loading1, error1) => <>
            <ApiRequest onDemand token={this.state.searchTerm + this.state.forceRequestId} requiresStreamer onRequest={this.onRequestRegisteredSearch}>
              {(result2, loading2, error2) => <>
                {loading1 ?? loading2}
                {this.state.searchTerm !== '' && error1}
                {this.state.searchTerm !== '' && error2}
                {result1 != null && result2 != null && this.state.hideResultsForRequestId !== this.state.requestId &&
                  <Box sx={{ mt: 2 }}>
                    {result1.results.length + result2.results.length === 0
                      ?
                      <div>No users found</div>
                      :
                      sortBy(
                        group([...result1.results, ...result2.results], x => x.user.primaryUserId),
                        x => x.items[0].user.levelInfo.level + x.items[0].user.levelInfo.levelProgress + (x.items[0].user.registeredUser != null ? 100 : 0), // display registered users at the top
                        'desc'
                      ).map(({ group: _, items }, i) => (
                        <UserItem
                          key={i}
                          matchResult={items[0]}
                          greyOutDefaultUsers={this.props.greyOutDefaultUsers}
                          isHovering={this.state.hoveringPrimaryUserId === items[0].user.primaryUserId}
                          onSelect={() => this.onPickResult(items[0])}
                          onHover={() => this.setState({ hoveringPrimaryUserId: items[0].user.primaryUserId })}
                        />
                      ))
                    }
                  </Box>
                }
              </>}
            </ApiRequest>
          </>}
        </ApiRequest>
      </div>
    </div>
  }
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


function debounce<TArgs extends any[]> (callback: (...args: TArgs) => void, ms: number) {
  let timer: number | null = null

  return (...args: TArgs) => {
    if (timer != null) {
      window.clearTimeout(timer)
    }

    timer = window.setTimeout(() => {
      timer = null
      callback(...args)
    }, ms)
  }
}
