import { Alert, Box, Button, CircularProgress } from '@mui/material'
import { ApiResponse, ResponseData } from '@rebel/api-models/types'
import { waitUntil } from '@rebel/shared/util/typescript'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import * as React from 'react'

type Props<TData extends ResponseData<TData>> = {
  // if providing a function, the children will always be rendered, otherwise they will only be rendered upon a successful response
  children?: ((response: TData | null, loadingNode: React.ReactNode | null, errorNode: React.ReactNode) => React.ReactNode) | React.ReactNode
  hideRetryOnError?: boolean
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
}) & ({
  onDemand: true
  token: string | number | null // when changing this token, a new request will automatically be made. if null, will not make a request
} | {
  onDemand: false
  repeatInterval: number // when provided, a new request will automatically be made after the given time (once the previous scheduled request has finished), even if the token doesn't change
})

type State<TData extends ResponseData<TData>> = {
  isLoading: boolean
  response: ApiResponse<TData> | null
  error: string | null
}

// finally some code I am not appalled by
// edit: after refactoring this a bit, I take it back
export default class ApiRequest<TData extends ResponseData<TData>> extends React.PureComponent<Props<TData>, State<TData>> {
  static override contextType = LoginContext
  override context!: React.ContextType<typeof LoginContext>

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

    // chunky because typescript is dumb
    if (this.props.isAnonymous) {
      this.props.onRequest()
        .then(res => this.onResponse(res, token))
        .catch(e => this.onError(e.message, token))
        .finally(() => this.onDone())
    } else {
      waitUntil(() => !this.context.isLoading, 50, 10000).then(() => {
        if (this.context.username == null || this.context.loginToken == null) {
          this.onError('You must be logged in to do that', token)
          return
        }

        if (this.props.requiresStreamer) {
          if (this.context.streamer == null) {
            this.onError('You must select a streamer context', token)
            return
          }

          this.props.onRequest(this.context.loginToken, this.context.streamer)
            .then(res => this.onResponse(res, token))
            .catch(e => this.onError(e.message, token))
            .finally(() => this.onDone())
        } else {
          this.props.onRequest(this.context.loginToken)
            .then(res => this.onResponse(res, token))
            .catch(e => this.onError(e.message, token))
            .finally(() => this.onDone())
        }
      })
    }
  }

  private onResponse (data: ApiResponse<TData>, token: string | number | null) {
    if (!this.mounted || this.currentToken !== token) {
      return
    }

    this.setState({
      isLoading: false,
      response: data,
      error: null
    })
  }

  private onError (msg: string, token: string | number | null) {
    if (!this.mounted || this.currentToken !== token) {
      return
    }

    this.setState({
      isLoading: false,
      response: null,
      error: msg
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
    if (this.props.isAnonymous !== true && (this.context.username == null && !this.context.isLoading)) {
      return <Alert severity="error">You must be logged in to do that.</Alert>
    }

    let loadingNode: React.ReactNode = null
    let errorNode: React.ReactNode = null

    if (this.state.isLoading || this.context.isLoading) {
      loadingNode = (
        <Box sx={{ m: 1, display: 'flex', alignItems: 'center' }}>
          <CircularProgress size="1rem" />
          <Box sx={{ display: 'inline', pl: 1 }}>Loading...</Box>
        </Box>
      )
    }

    let error = this.state.error
    const response = this.state.response
    if (response != null) {
      if (response.success && typeof this.props.children !== 'function') {
        return this.props.children ?? null
      } else if (!response.success) {
        error = response.error.message
      }
    }

    if (error != null) {
      errorNode = (
        <Alert severity="error" action={this.props.onDemand && !this.props.hideRetryOnError && <Button onClick={this.onRetry}>Retry</Button>}>
          Error: {error}
        </Alert>
      )
    }

    let returnNode: React.ReactNode = null
    if (typeof this.props.children === 'function') {
      returnNode = this.props.children(response?.success ? response.data as TData : null, loadingNode, errorNode)
    }

    return returnNode ?? loadingNode ?? errorNode
  }
}
