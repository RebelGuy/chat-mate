import { Tooltip } from '@mui/material'
import { CSSProperties } from 'react'
import { Box } from '@mui/system'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import Discord from '@rebel/studio/icons/Discord'
import GitHub from '@rebel/studio/icons/GitHub'
import Twitch from '@rebel/studio/icons/Twitch'
import Twitter from '@rebel/studio/icons/Twitter'
import YouTube from '@rebel/studio/icons/YouTube'
import { ReactElement } from 'react'

const style: CSSProperties = {
  fontSize: 32,
  color: 'rgb(64,64,64)'
}

export default function Socials () {
  return (
    <Box style={{ display: 'flex', justifyContent: 'space-between', margin: 8 }}>
      <Icon icon={<GitHub style={style} />} url="https://github.com/RebelGuy/chat-mate" tooltip="ChatMate on GitHub" />
      <Icon icon={<Discord style={style} />} url="https://discord.gg/2AtFv8XzAR" tooltip="PvP School" />
      <Icon icon={<YouTube style={style} />} url="https://youtube.com/@Rebel_Guy" tooltip="Rebel Guy' YouTube channel" />
      <Icon icon={<Twitch style={style} />} url="https://twitch.com/rebel_guymc" tooltip="Rebel Guy's Twitch channel" />
      <Icon icon={<Twitter style={style} />} url="https://twitter.com/Rebel_GuyMC" tooltip="Rebel Guy's Twitter" />
    </Box>
  )
}

type IconProps = {
  icon: ReactElement
  tooltip: string
  url: string
}

function Icon (iconProps: IconProps) {
  return (
    <Tooltip title={iconProps.tooltip}>
      <Box display="inline">
        <LinkInNewTab href={iconProps.url} hideTextDecoration>
          {iconProps.icon}
        </LinkInNewTab>
      </Box>
    </Tooltip>
  )
}
