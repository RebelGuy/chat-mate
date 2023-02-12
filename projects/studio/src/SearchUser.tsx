import { PublicUserSearchResult } from '@rebel/server/controllers/public/user/PublicUserSearchResult'
import { group, sortBy } from '@rebel/shared/util/arrays'
import { searchRegisteredUser, searchUser } from '@rebel/studio/api'
import ApiRequest from '@rebel/studio/ApiRequest'
import * as React from 'react'

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
    const result = await searchUser(loginToken, streamer, this.state.searchTerm)
    this.setState({ requestId: this.state.requestId + 1 })
    return result
  }

  onRequestRegisteredSearch = async (loginToken: string, streamer: string) => {
    const result = await searchRegisteredUser(loginToken, streamer, this.state.searchTerm)
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

  override render(): React.ReactNode {
    // result1: channel search
    // result2: registered user search

    // The two results may have overlap

    return <div style={{ marginBottom: 16 }}>
      <input type="text" value={this.state.currentInput} onChange={this.onChangeInput} />
      <button onClick={this.onForceSearch}>Search</button>
      <div onMouseLeave={() => this.setState({ hoveringPrimaryUserId: -1 })}>
        <ApiRequest onDemand token={this.state.searchTerm + this.state.forceRequestId} requiresStreamer onRequest={this.onRequestChannelSearch}>
          {(result1, loading1, error1) => <>
            <ApiRequest onDemand token={this.state.searchTerm + this.state.forceRequestId} requiresStreamer onRequest={this.onRequestRegisteredSearch}>
              {(result2, loading2, error2) => <>
                {loading1 ?? loading2}
                {this.state.searchTerm !== '' && error1}
                {this.state.searchTerm !== '' && error2}
                {result1 != null && result2 != null && this.state.hideResultsForRequestId !== this.state.requestId && (result1.results.length + result2.results.length === 0 ? <div>No users found</div> : sortBy(
                  group([...result1.results, ...result2.results], x => x.user.primaryUserId),
                  x => x.items[0].user.levelInfo.level + x.items[0].user.levelInfo.levelProgress + (x.items[0].user.registeredUser != null ? 100 : 0), // display registered users at the top
                  'desc'
                ).map(({ group: _, items: result }) => {
                  const { user, matchedChannel, allChannels } = result[0]
                  if (user.registeredUser == null) {
                    // `matchedChannel` is always defined for default user results
                    return (
                      <div
                        key={user.primaryUserId}
                        style={{ cursor: 'pointer', color: this.props.greyOutDefaultUsers ? 'grey' : undefined, background: this.state.hoveringPrimaryUserId === user.primaryUserId ? 'rgba(0, 0, 0, 0.2)' : undefined }}
                        onClick={() => this.onPickResult(result[0])}
                        onMouseEnter={() => this.setState({ hoveringPrimaryUserId: user.primaryUserId })}
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
                      style={{ cursor: 'pointer', background: this.state.hoveringPrimaryUserId === user.primaryUserId ? 'rgba(0, 0, 0, 0.2)' : undefined }}
                      onClick={() => this.onPickResult(result[0])}
                      onMouseEnter={() => this.setState({ hoveringPrimaryUserId: user.primaryUserId })}
                    >
                      {user.registeredUser.displayName} ({youtubeChannels} YT and {twitchChannels} TW)
                    </div>
                  )
                }))}
              </>}
            </ApiRequest>
          </>}
        </ApiRequest>
      </div>
    </div>
  }
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
