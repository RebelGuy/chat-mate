import { Button, TextField } from '@mui/material'
import { Box } from '@mui/system'
import { MAX_CHANNEL_LINKS_ALLOWED } from '@rebel/shared/constants'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import { createLinkToken } from '@rebel/studio/utility/api'
import React from 'react'

const CHANNEL_ID_ILLEGAL_CHARS = '!@#$%^&*(){}|;:\'"`~?/>.<,=+[]\\'

export function CreateLinkToken (props: { linkedCount: number, onCreated: () => void }) {
  const [channelInput, setChannelInput] = React.useState('')
  const { channelId, platform, error: validationError } = validateChannel(channelInput)
  const showError = channelInput.length > 0 && validationError != null

  const onCreateLinkToken = async (loginToken: string) => {
    if (channelId == null) {
      throw new Error('Channel ID is null')
    }
    const result = await createLinkToken(loginToken, channelId)

    if (result.success) {
      props.onCreated()
    }

    return result
  }

  return <div>
    <h3>Link a New Channel</h3>
    {props.linkedCount >= MAX_CHANNEL_LINKS_ALLOWED && <div style={{ color: 'red', fontWeight: 700 }}>You have linked the maximum allowed number of channels.</div>}
    <ApiRequestTrigger onRequest={onCreateLinkToken}>
      {(onMakeRequest, response, loadingNode, errorNode) =>
        <Box sx={{ display : 'flex', flexDirection: 'column' }}>
          <TextField
            disabled={loadingNode != null}
            label="Channel URL or ID"
            value={channelInput}
            onChange={e => setChannelInput(e.target.value)}
            sx={{ maxWidth: '600px' }}
            error={showError}
            helperText={validationError}
          />
          {channelId != null && platform != null && <Box sx={{ mt: 1 }}>
            Please confirm you wish to link&nbsp;
            <LinkInNewTab href={getChannelUrl(channelId, platform)}>
              this {platform === 'youtube' ? 'YouTube' : 'Twitch'} channel
            </LinkInNewTab>.
          </Box>}
          <Button
            disabled={loadingNode != null || showError || channelId == null || props.linkedCount >= MAX_CHANNEL_LINKS_ALLOWED}
            onClick={onMakeRequest}
            sx={{ mt: 1, mb: 2 }}
            style={{ width: 'fit-content' }}
          >
            Start the link process
          </Button>
          {loadingNode}
          {errorNode}
        </Box>
      }
    </ApiRequestTrigger>
  </div>
}

function validateChannel (channel: string): { channelId: string | null, platform: 'youtube' | 'twitch' | null, error: string | null } {
  if (isNullOrEmpty(channel)) {
    return { channelId: null, platform: null, error: null }
  }

  if (channel.includes('/channel/')) {
    channel = channel.substring(channel.indexOf('/channel/') + '/channel/'.length)
  } else if (channel.includes('twitch.tv/')) {
    channel = channel.substring(channel.indexOf('twitch.tv/') + 'twitch.tv/'.length)
  }

  if (channel.startsWith('UC')) {
    if (channel.length === 24) {
      return { channelId: channel, platform: 'youtube', error: null }
    } else {
      return { channelId: null, platform: 'youtube', error: 'Invalid YouTube channel ID - expected 24 characters' }
    }
  }

  for (const c of CHANNEL_ID_ILLEGAL_CHARS) {
    if (channel.includes(c)) {
      return { channelId: null, platform: null, error: 'Invalid channel ID - includes special characters' }
    }
  }

  return { channelId: channel, platform: 'twitch', error: null }
}

function getChannelUrl (channelId: string, platform: 'youtube' | 'twitch') {
  return platform === 'youtube' ? `https://youtube.com/channel/${channelId}` : `https://twitch.tv/${channelId}`
}
