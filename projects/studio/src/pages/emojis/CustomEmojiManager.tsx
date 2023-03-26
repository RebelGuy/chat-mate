import { ReactNode, useContext, useEffect, useState } from 'react'
import { PublicCustomEmoji } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { addCustomEmoji, getAccessibleRanks, getAllCustomEmojis, updateCustomEmoji } from '@rebel/studio/utility/api'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import ApiRequest from '@rebel/studio/components/ApiRequest'
import { sortBy } from '@rebel/shared/util/arrays'
import RequireRank from '@rebel/studio/components/RequireRank'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { Box, Button, IconButton, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import TextWithHelp from '@rebel/studio/components/TextWithHelp'
import CustomEmojiEditor from '@rebel/studio/pages/emojis/CustomEmojiEditor'
import { ApiResponse } from '@rebel/server/controllers/ControllerBase'
import { GetCustomEmojisResponse } from '@rebel/server/controllers/EmojiController'
import RanksDisplay from '@rebel/studio/pages/emojis/RanksDisplay'
import { Close, Done, Edit } from '@mui/icons-material'
import { waitUntil } from '@rebel/shared/util/typescript'
import CopyText from '@rebel/studio/components/CopyText'

export type EmojiData = Omit<PublicCustomEmoji, 'isActive' | 'version'>

type State = {
  emojis: PublicCustomEmoji[]
  accessibleRanks: PublicRank[]
  editingEmoji: EmojiData | null
  editingError: ReactNode
  isLoadingEdit: boolean
  openEditor: boolean
}

export default function CustomEmojiManager () {
  const loginContext = useContext(LoginContext)
  const [emojis, setEmojis] = useState<PublicCustomEmoji[]>([])
  const [accessibleRanks, setAccessibleRanks] = useState<PublicRank[]>([])
  const [editingEmoji, setEditingEmoji] = useState<EmojiData | null>(null)
  const [editingError, setEditingError] = useState<ReactNode>(null)
  const [isLoadingEdit, setIsLoadingEdit] = useState<boolean>(false)
  const [openEditor, setOpenEditor] = useState<boolean>(false)

  useEffect(() => {
    const hydrateRanks = async () => {
      await waitUntil(() => loginContext.initialised && !loginContext.isLoading, 100, 5000)
      const response = await getAccessibleRanks(loginContext.loginToken!, loginContext.streamer!)
      if (response.success) {
        setAccessibleRanks(response.data.accessibleRanks)
      }
    }
    void hydrateRanks()
  }, [])

  const onEdit = (id: number | null) => {
    setEditingEmoji(emojis.find(emoji => emoji.id === id) ?? null)
    setOpenEditor(true)
  }

  const onCancelEdit = () => {
    setOpenEditor(false)
    setEditingEmoji(null)
    setEditingError(null)
    setIsLoadingEdit(false)
  }

  const onUpdate = async (loginToken: string, streamer: string, updatedData: EmojiData) => {
    const result = await updateCustomEmoji(updatedData, loginToken, streamer)
    if (result.success) {
      const updatedEmoji = result.data.updatedEmoji
      setEditingEmoji(null)
      setEmojis(emojis.map(emoji => emoji.id === updatedEmoji.id ? updatedEmoji : emoji))
    }
    return result
  }

  const onAdd = async (loginToken: string, streamer: string, data: EmojiData) => {
    const result = await addCustomEmoji(data, loginToken, streamer)
    if (result.success) {
      setEmojis([...emojis, result.data.newEmoji])
    }
    return result
  }

  const onSave = async (data: EmojiData) => {
    setIsLoadingEdit(true)
    setEditingError(null)

    let response: ApiResponse<any>
    try {
      if (editingEmoji?.id === data.id) {
        response = await onUpdate(loginContext.loginToken!, loginContext.streamer!, data)
      } else {
        response = await onAdd(loginContext.loginToken!, loginContext.streamer!, data)
      }
    } catch (e: any) {
      response = {
        success: false,
        timestamp: Date.now(),
        error: {
          errorCode: 500,
          errorType: 'Unknown',
          message: e.message
        }
      }
    }

    setIsLoadingEdit(false)
    setEditingError(response.success ? null : response.error.message)

    if (response.success) {
      setOpenEditor(false)
      setEditingEmoji(null)
    }
  }

  const onCheckDupliateSymbol = (symbol: string) => {
    return emojis.find(emoji => {
      return emoji.id !== editingEmoji?.id && emoji.symbol === symbol
    }) != null
  }

  const getEmojis = async (loginToken: string, streamer: string): Promise<GetCustomEmojisResponse> => {
    const response = await getAllCustomEmojis(loginToken, streamer)
    if (response.success) {
      setEmojis(sortBy(response.data.emojis, e => e.id))
    }
    return response
  }

  return (
    <>
      <ApiRequest onDemand token={loginContext.streamer} requiresStreamer onRequest={getEmojis}>
        {(data, loadingNode, errorNode) => <>
          {data != null &&
            <Box>
              <RequireRank owner>
                <Button
                  onClick={() => onEdit(null)}
                  sx={{ mb: 1 }}
                >
                  Create new emoji
                </Button>
              </RequireRank>

              <Table
                stickyHeader
                sx={{ width: '100%', transform: 'translateY(-5px)' }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Level Req.</TableCell>
                    <TableCell><TextWithHelp text="$" help="Emoji can be used in donation messages" /></TableCell>
                    <TableCell><TextWithHelp text="Rank Whitelist" help="If there is no selection, all ranks will be able to use the emoji" /></TableCell>
                    <TableCell>Image</TableCell>
                    <RequireRank owner><TableCell>Action</TableCell></RequireRank>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {emojis.map(emoji =>
                    <CustomEmojiRow
                      key={emoji.id}
                      data={emoji}
                      accessibleRanks={accessibleRanks}
                      onEdit={() => onEdit(emoji.id)}
                    />)
                  }
                </TableBody>
              </Table>
            </Box>
          }
          {loadingNode}
          {errorNode}
        </>}
      </ApiRequest>

      <CustomEmojiEditor
        open={openEditor}
        accessibleRanks={accessibleRanks}
        data={editingEmoji}
        error={editingError}
        isLoading={isLoadingEdit}
        onCancel={onCancelEdit}
        onSave={onSave}
        onCheckDuplicateSymbol={onCheckDupliateSymbol}
      />
    </>
  )
}

function CustomEmojiRow (props: { data: EmojiData, accessibleRanks: PublicRank[], onEdit: (id: number) => void }) {
  const symbol = `:${props.data.symbol}:`

  return (
    <tr>
      <TableCell>{props.data.name}</TableCell>
      <TableCell>
        {symbol}
        <CopyText text={symbol} tooltip="Copy symbol to clipboard" sx={{ ml: 1 }} />
      </TableCell>
      <TableCell>{props.data.levelRequirement}</TableCell>
      <TableCell>{props.data.canUseInDonationMessage ? <Done /> : <Close />}</TableCell>
      <TableCell><RanksDisplay ranks={props.data.whitelistedRanks} accessibleRanks={props.accessibleRanks} /></TableCell>
      <TableCell>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {!isNullOrEmpty(props.data.imageData) && <img src={`data:image/png;base64,${props.data.imageData}`} style={{ maxHeight: 32 }} alt="" />}
        </div>
      </TableCell>
      <RequireRank owner>
        <TableCell>
          <IconButton onClick={() => props.onEdit(props.data.id)}>
            <Edit />
          </IconButton>
        </TableCell>
      </RequireRank>
    </tr>
  )
}
