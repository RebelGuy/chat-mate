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
import useRequest, { SuccessfulResponseData } from '@rebel/studio/hooks/useRequest'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'

export type EmojiData = Omit<PublicCustomEmoji, 'isActive' | 'version'>

const emojiSorter = (data: SuccessfulResponseData<GetCustomEmojisResponse>) => ({ emojis: sortBy(data.emojis, e => e.id)})

export default function CustomEmojiManager () {
  const [editingEmoji, setEditingEmoji] = useState<EmojiData | null>(null)
  const [editingError, setEditingError] = useState<ReactNode>(null)
  const [openEditor, setOpenEditor] = useState<boolean>(false)
  const [editingType, setEditingType] = useState<'new' | 'edit'>('new')
  const [refreshToken, updateRefreshToken] = useUpdateKey()
  const emojisRequest = useRequest(getAllCustomEmojis(), {
    updateKey: refreshToken,
    transformer: emojiSorter
  })
  const accessibleRanksRequest = useRequest(getAccessibleRanks(), { updateKey: refreshToken })

  const onEdit = (id: number | null) => {
    setEditingEmoji(emojisRequest.data!.emojis.find(emoji => emoji.id === id) ?? null)
    setOpenEditor(true)
    setEditingType(id == null ? 'new' : 'edit')
  }

  const onCancelEdit = () => {
    setOpenEditor(false)
    setEditingEmoji(null)
    setEditingError(null)
  }

  const onChange = (data: EmojiData) => {
    setEditingEmoji(data)
  }

  const onSave = (emoji: PublicCustomEmoji) => {
    // optimistic cache update
    if (emojisRequest.data != null) {
      const currentEmojis = emojisRequest.data.emojis
      if (currentEmojis.find(e => e.id === emoji.id)) {
        emojisRequest.mutate({ emojis: currentEmojis.map(e => e.id === emoji.id ? emoji : e) })
      } else {
        emojisRequest.mutate({ emojis: [...currentEmojis, emoji] })
      }
    }

    setOpenEditor(false)
    setEditingEmoji(null)
    updateRefreshToken()
  }

  const onCheckDupliateSymbol = (symbol: string) => {
    return emojisRequest.data!.emojis.find(emoji => {
      return emoji.id !== editingEmoji?.id && emoji.symbol === symbol
    }) != null
  }

  return (
    <>
      <PanelHeader>Emojis {<RefreshButton isLoading={emojisRequest.isLoading} onRefresh={updateRefreshToken} />}</PanelHeader>

      {emojisRequest.data != null &&
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
              {emojisRequest.data.emojis.map(emoji =>
                <CustomEmojiRow
                  key={emoji.id}
                  data={emoji}
                  accessibleRanks={accessibleRanksRequest.data?.accessibleRanks ?? []}
                  isLoading={emojisRequest.isLoading}
                  onEdit={() => onEdit(emoji.id)}
                />)
              }
            </TableBody>
          </Table>
        </Box>
      }
      <ApiLoading requestObj={[emojisRequest, accessibleRanksRequest]} initialOnly />
      <ApiError requestObj={[emojisRequest, accessibleRanksRequest]} />

      <CustomEmojiEditor
        type={editingType}
        open={openEditor}
        accessibleRanks={accessibleRanksRequest.data?.accessibleRanks ?? []}
        data={editingEmoji}
        error={editingError}
        isLoading={emojisRequest.isLoading}
        onCancel={onCancelEdit}
        onChange={onChange}
        onSave={onSave}
        onCheckDuplicateSymbol={onCheckDupliateSymbol}
      />
    </>
  )
}

function CustomEmojiRow (props: { data: EmojiData, accessibleRanks: PublicRank[], isLoading: boolean, onEdit: (id: number) => void }) {
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
          <IconButton disabled={props.isLoading} onClick={() => props.onEdit(props.data.id)}>
            <Edit />
          </IconButton>
        </TableCell>
      </RequireRank>
    </tr>
  )
}
