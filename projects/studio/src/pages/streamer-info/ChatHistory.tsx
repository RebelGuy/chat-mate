import { Box } from '@mui/material'
import { PublicChatItem } from '@rebel/api-models/public/chat/PublicChatItem'
import { PublicMessageCustomEmoji } from '@rebel/api-models/public/chat/PublicMessageCustomEmoji'
import { PublicMessageEmoji } from '@rebel/api-models/public/chat/PublicMessageEmoji'
import { PublicMessagePart } from '@rebel/api-models/public/chat/PublicMessagePart'
import { PublicMessageText } from '@rebel/api-models/public/chat/PublicMessageText'
import { Primitive } from '@rebel/shared/types'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import useRequest from '@rebel/studio/hooks/useRequest'
import YouTube from '@rebel/studio/icons/YouTube'
import TwitchIcon from '@rebel/studio/icons/Twitch'
import { Level } from '@rebel/studio/pages/main/UserInfo'
import { getChat } from '@rebel/studio/utility/api'
import { PublicRank } from '@rebel/api-models/public/rank/PublicRank'
import { sortBy } from '@rebel/shared/util/arrays'
import { useContext, useEffect, useRef, useState } from 'react'
import { ClientMessage, ServerMessage } from '@rebel/api-models/websocket'
import { addTime } from '@rebel/shared/util/datetime'
import WebsocketContext from '@rebel/studio/contexts/WebsocketContext'

const RANK_ORDER: PublicRank['name'][] = ['owner', 'admin', 'mod', 'member', 'supporter', 'donator']

type Props = {
  streamer: string
  updateKey: Primitive
  direction: 'asc' | 'desc'
}

export default function ChatHistory (props: Props) {
  const websocketContext = useContext(WebsocketContext)
  const [chat, setChat] = useState<PublicChatItem[]>([])
  const getChatTimestamp = useRef(addTime(new Date(), 'days', -1).getTime())

  const getLivestreamsRequest = useRequest(getChat(getChatTimestamp.current, 30), {
    updateKey: props.updateKey,
    onSuccess: (data) => setChat(data.chat)
  })

  useEffect(() => {
    if (websocketContext.state !== 'connected') {
      return
    }

    websocketContext.websocket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data) as ServerMessage
      if (message.type === 'event' && message.data.topic === 'streamerChat') {
        const item: PublicChatItem = message.data.data
        setChat(currentItems => [...currentItems, item])
      }
    })
  }, [websocketContext.state, websocketContext.websocket])

  useEffect(() => {
    if (websocketContext.state !== 'connected') {
      return
    }

    const subscribeMsg: ClientMessage = {
      type: 'subscribe',
      data: { topic: 'streamerChat', streamer: props.streamer }
    }
    websocketContext.websocket.send(JSON.stringify(subscribeMsg))

    return () => {
      const unsubscribeMsg: ClientMessage = {
        type: 'unsubscribe',
        data: { topic: 'streamerChat', streamer: props.streamer }
      }
      websocketContext.websocket.send(JSON.stringify(unsubscribeMsg))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.streamer, websocketContext.state, websocketContext.websocket])

  return (
    <Box>
      {sortBy(chat, c => c.timestamp, props.direction).map((msg, i) => <ChatMessage key={i} msg={msg} />)}
      <ApiLoading requestObj={getLivestreamsRequest} />
      <ApiError requestObj={getLivestreamsRequest} />
    </Box>
  )
}

type ChatMessageProps = {
  msg: PublicChatItem
}

function ChatMessage (props: ChatMessageProps) {
  const msg = props.msg
  const name = <Box display="inline" fontWeight={700}>{msg.author.channel.displayName}</Box>
  const level = <Box display="inline" mr={0.5}><Level level={msg.author.levelInfo.level} /></Box>
  const messageParts = msg.messageParts.map((part, i) => <MessagePart key={i} part={part} />)
  const platformIcon = <Box display="inline" style={{ verticalAlign: 'middle' }} mr={0.5}>{msg.platform === 'youtube' ? <YouTube htmlColor="red" /> : <TwitchIcon htmlColor="#6441A5" />}</Box>
  const rank = <Box display="inline" mr={0.5} color="rgb(170, 0, 170)" fontWeight={700}>{msg.author.activeRanks.length === 0 ? 'VIEWER' : sortBy(msg.author.activeRanks, r => RANK_ORDER.findIndex(n => n === r.rank.name))[0].rank.name.toUpperCase()}</Box>

  return (
    <Box>
      {level}{platformIcon}{rank}{name}: {messageParts}
    </Box>
  )
}

type MessagePartProps = {
  part: PublicMessagePart
}

function MessagePart (props: MessagePartProps) {
  const part = props.part

  return (
    <Box display="inline">
      {part.textData && <TextPart data={part.textData} />}
      {part.emojiData && <EmojiPart data={part.emojiData} />}
      {part.customEmojiData && <CustomEmojiPart data={part.customEmojiData} />}
    </Box>
  )
}

type TextPartProps = {
  data: PublicMessageText
}

function TextPart (props: TextPartProps) {
  const data = props.data

  return <>{data.text}</>
}

type EmojiPartProps = {
  data: PublicMessageEmoji
}

function EmojiPart (props: EmojiPartProps) {
  const data = props.data

  return <Box display="inline">
    <img style={{ height: '1.5em', verticalAlign: 'middle' }} src={data.image?.url} alt="" />
  </Box>
}

type CustomEmojiPartProps = {
  data: PublicMessageCustomEmoji
}

function CustomEmojiPart (props: CustomEmojiPartProps) {
  const data = props.data

  return <Box display="inline">
    <img style={{ height: '1.5em', verticalAlign: 'middle' }} src={data.customEmoji.imageUrl} alt="" />
  </Box>
}
