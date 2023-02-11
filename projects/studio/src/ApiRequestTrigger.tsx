import { ResponseData, ApiResponse } from '@rebel/server/controllers/ControllerBase'
import ApiRequest from '@rebel/studio/ApiRequest'
import * as React from 'react'

type Props<TData extends ResponseData<TData>> = {
  // if providing a function, the children will always be rendered, otherwise they will only be rendered upon a successful response
  children: (onMakeRequest: () => void, response: TData | null, loadingNode: React.ReactNode | null, errorNode: React.ReactNode) => React.ReactNode
} & ({
  isAnonymous: true
  requiresStreamer?: false
  onRequest: () => Promise<ApiResponse<TData>>
} | {
  isAnonymous?: false
  requiresStreamer?: false
  onRequest: (loginToken: string) => Promise<ApiResponse<TData>>
} | {
  isAnonymous?: false
  requiresStreamer: true
  onRequest: (loginToken: string, streamer: string) => Promise<ApiResponse<TData>>
})

type State<TData extends ResponseData<TData>> = {
  token: number
}

export default class ApiRequestTrigger<TData extends ResponseData<TData>> extends React.PureComponent<Props<TData>, State<TData>> {
  constructor (props: Props<TData>) {
    super(props)
    this.state = {
      token: 0
    }
  }

  onMakeRequest = () => {
    this.setState(state => ({ token: state.token + 1 }))
  }

  override render () {
    // any-typing required to make typescript happy
    return (
      <ApiRequest
        onDemand
        token={this.state.token === 0 ? null : this.state.token}
        isAnonymous={this.props.isAnonymous as any}
        requiresStreamer={this.props.requiresStreamer as any}
        onRequest={this.props.onRequest}
      >
        {(response: TData | null, loadingNode: React.ReactNode | null, errorNode: React.ReactNode) => this.props.children(this.onMakeRequest, response, loadingNode, errorNode)}
      </ApiRequest>
    )
  }
}
