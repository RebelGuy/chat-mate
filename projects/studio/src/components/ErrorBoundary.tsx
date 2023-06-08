import { Box, Button } from '@mui/material'
import CopyText from '@rebel/studio/components/CopyText'
import TextWithNewlines from '@rebel/studio/components/TextWithNewlines'
import React from 'react'

type Props = {
  children: React.ReactElement
}

type State = {
  error: string | null
  componentStack: string | null
}

export default class ErrorBoundary extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props)
    this.state = {
      error: null,
      componentStack: null
    }
  }

  private onRestart = () => {
    window.location.href = '/'
  }

  override componentDidCatch (error: any, errorInfo: any) {
    console.error(error)
    console.log(errorInfo.componentStack)

    this.setState({
      error: error.message,
      componentStack: errorInfo.componentStack
    })
  }

  override render () {
    if (this.state.error != null) {
      return <Box sx={{ ml: 2, typography: 'body1' }}>
        <h2>Something went wrong</h2>
        <div>{this.state.error}</div>
        <TextWithNewlines text={this.state.componentStack!} sx={{ mt: 0, ml: 2 }} />
        <Box display="flex" alignItems="center" sx={{ mt: 2 }}>
          <Button onClick={this.onRestart} sx={{ mr: 2 }}>Restart</Button>
          <CopyText text={this.state.error + '\n' + this.state.componentStack} tooltip="Copy error" />
        </Box>
      </Box>
    }

    return this.props.children
  }
}
