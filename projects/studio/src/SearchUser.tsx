import { PublicUserSearchResult } from '@rebel/server/controllers/public/user/PublicUserSearchResult'
import { group, sortBy } from '@rebel/server/util/arrays'
import { searchUser } from '@rebel/studio/api'
import ApiRequest from '@rebel/studio/ApiRequest'
import * as React from 'react'

type Props = {
  greyOutDefaultUsers: boolean
  onPickResult: (result: Pick<PublicUserSearchResult, 'user' | 'allChannels'>) => void
}

type State = {
  currentInput: string
  searchTerm: string
  requestId: number
  hideResultsForRequestId: number
}

export default class SearchUser extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props)

    this.state = {
      currentInput: '',
      searchTerm: '',
      requestId: 0,
      hideResultsForRequestId: 0
    }
  }

  onSetSearchString = debounce((searchString: string) => {
    this.setState({ searchTerm: searchString })
  }, 1000)

  onChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ currentInput: e.target.value })
    this.onSetSearchString(e.target.value)
  }

  onRequest = async (loginToken: string, streamer: string) => {
    const result = await searchUser(loginToken, streamer, this.state.searchTerm)
    this.setState({ requestId: this.state.requestId + 1 })
    return result
  }

  onPickResult = (result: Pick<PublicUserSearchResult, 'user' | 'allChannels'>) => {
    this.setState({ hideResultsForRequestId: this.state.requestId })
    this.props.onPickResult(result)
  }

  override render(): React.ReactNode {
    return <>
      <input type="text" value={this.state.currentInput} onChange={this.onChangeInput} />
      <ApiRequest onDemand token={this.state.searchTerm} requiresStreamer onRequest={this.onRequest}>
        {(result, loading, error) => <>
          {loading}
          {this.state.searchTerm !== '' && error}
          {result != null && this.state.hideResultsForRequestId !== this.state.requestId && sortBy(
            group(result.results, x => x.user.primaryUserId),
            x => x.items[0].user.levelInfo.level + x.items[0].user.levelInfo.levelProgress,
            'desc'
          ).map(({ group: _, items: result }) => {
            const { user, matchedChannel, allChannels } = result[0]
            if (user.registeredUser == null) {
              return <div style={{ cursor: 'pointer', color: this.props.greyOutDefaultUsers ? 'grey' : undefined }} onClick={() => this.onPickResult({ user, allChannels })}>
                [{matchedChannel.platform === 'youtube' ? 'YT' : 'TW'}] {matchedChannel.displayName}
              </div>
            }

            const youtubeChannels = allChannels.filter(c => c.platform === 'youtube').length
            const twitchChannels = allChannels.filter(c => c.platform === 'youtube').length
            return <div style={{ cursor: 'pointer' }} onClick={() => this.onPickResult({ user, allChannels })}>
              {user.registeredUser.displayName} ({youtubeChannels} YT and {twitchChannels} TW)
            </div>
          })}
        </>}
      </ApiRequest>
    </>
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
