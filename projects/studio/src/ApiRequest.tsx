import { ApiResponse, ResponseData } from '@rebel/server/controllers/ControllerBase'
import * as React from 'react'

type Props<TData extends ResponseData<TData>> = {
  onRequest: () => Promise<ApiResponse<any, TData>>
  // if providing a function, the children will always be rendered, otherwise they will only be rendered upon a successful response
  children: ((response: TData | null, loadingNode: React.ReactNode | null, errorNode: React.ReactNode) => React.ReactNode) | React.ReactNode
} & ({
  onDemand: true
  token: string | number | null // when changing this token, a new request will automatically be made. if null, will not make a request
} | {
  onDemand: false
  repeatInterval: number // when provided, a new request will automatically be made after the given time (once the previous scheduled request has finished), even if the token doesn't change
})

type State<TData extends ResponseData<TData>> = {
  isLoading: boolean
  response: ApiResponse<any, TData> | null
  error: string | null
}

// finally some code I am not appalled by
// edit: after refactoring this a bit, I take it back
export default class ApiRequest<TData extends ResponseData<TData>> extends React.PureComponent<Props<TData>, State<TData>> {
  private mounted = false
  private currentToken: string | number | null = null
  private timer: number | null = null

  constructor (props: Props<TData>) {
    super(props)
    this.state = {
      isLoading: false,
      response: null,
      error: null
    }
  }

  private makeRequest (token: string | number | null) {
    if (!this.mounted || this.currentToken === token || token == null) {
      this.currentToken = null
      return
    }

    this.setState({
      isLoading: true,
      response: null,
      error: null
    })

    this.currentToken = token
    this.props.onRequest()
      .then(res => this.onResponse(res, token))
      .catch(e => this.onError(e, token))
      .then(() => this.onDone())
  }

  private onResponse (data: ApiResponse<any, TData>, token: string | number | null) {
    if (!this.mounted || this.currentToken !== token) {
      return
    }

    this.setState({
      isLoading: false,
      response: data,
      error: null
    })
  }

  private onError (e: any, token: string | number | null) {
    if (!this.mounted || this.currentToken !== token) {
      return
    }

    this.setState({
      isLoading: false,
      response: null,
      error: e.message
    })
  }

  private onDone () {
    if (this.timer != null) {
      clearTimeout(this.timer)
    }

    if (this.props.onDemand === false) {
      const currentToken = Number(this.currentToken ?? 0)
      this.timer = window.setTimeout(() => this.makeRequest(currentToken + 1), this.props.repeatInterval)
    }
  }

  private onRetry = () => {
    this.currentToken = null
    if (this.props.onDemand) {
      this.makeRequest(this.props.token)
    } else {
      this.makeRequest(1)
    }
  }

  override componentDidMount () {
    this.mounted = true
    if (this.props.onDemand) {
      this.makeRequest(this.props.token)
    } else {
      this.makeRequest(1)
    }
  }

  override componentDidUpdate () {
    if (this.props.onDemand && this.currentToken !== this.props.token) {
      this.makeRequest(this.props.token)
    }
  }

  override componentWillUnmount () {
    this.mounted = false
  }

  override render () {
    let loadingNode: React.ReactNode = null
    let errorNode: React.ReactNode = null

    if (this.state.isLoading) {
      loadingNode = <div>Loading...</div>
    }
    
    let error = this.state.error
    const response = this.state.response
    if (response != null) {
      if (response.success && typeof this.props.children !== 'function') {
        return this.props.children
      } else if (!response.success) {
        error = response.error.message
      }
    }
    
    if (error != null) {
      errorNode = (
        <>
          <div style={{ color: 'red', padding: 12 }}>Error: {error}</div>
          <button onClick={this.onRetry}>Try again</button>
        </>
      )
    }

    let returnNode: React.ReactNode = null
    if (typeof this.props.children === 'function') {
      returnNode = this.props.children(response?.success ? response.data : null, loadingNode, errorNode)
    }
    
    return returnNode ?? loadingNode ?? errorNode
  }
}
