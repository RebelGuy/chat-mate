import { ReactNode, useContext, useEffect, useState } from 'react'
import { PublicCustomEmoji } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { addCustomEmoji, getAccessibleRanks, getAllCustomEmojis, updateCustomEmoji } from '@rebel/studio/utility/api'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import ApiRequest from '@rebel/studio/components/ApiRequest'
import { sortBy } from '@rebel/shared/util/arrays'
import RequireRank from '@rebel/studio/components/RequireRank'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { Box, Button, Checkbox, createTheme, FormControlLabel, Icon, IconButton, Table, TableBody, TableCell, TableHead, TableRow, ThemeProvider } from '@mui/material'
import TextWithHelp from '@rebel/studio/components/TextWithHelp'
import CustomEmojiEditor from '@rebel/studio/pages/emojis/CustomEmojiEditor'
import { ApiResponse } from '@rebel/server/controllers/ControllerBase'
import { GetCustomEmojisResponse } from '@rebel/server/controllers/EmojiController'
import RanksDisplay from '@rebel/studio/pages/emojis/RanksDisplay'
import { Close, Done, Edit, Lock } from '@mui/icons-material'
import { waitUntil } from '@rebel/shared/util/typescript'
import CopyText from '@rebel/studio/components/CopyText'
import useRequest, { SuccessfulResponseData } from '@rebel/studio/hooks/useRequest'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { request } from 'http'

export type EmojiData = Omit<PublicCustomEmoji, 'isActive' | 'version'>

const emojiSorter = (data: SuccessfulResponseData<GetCustomEmojisResponse>) => ({ emojis: sortBy(data.emojis, e => e.id)})

export default function CustomEmojiManager () {
  const loginContext = useContext(LoginContext)
  const [editingEmoji, setEditingEmoji] = useState<EmojiData | null>(null)
  const [editingError, setEditingError] = useState<ReactNode>(null)
  const [openEditor, setOpenEditor] = useState<boolean>(false)
  const [editingType, setEditingType] = useState<'new' | 'edit'>('new')
  const [showOnlyEligibleEmojis, setShowOnlyEligibleEmojis] = useState(!loginContext.hasRank('owner'))
  const [refreshToken, updateRefreshToken] = useUpdateKey()
  const emojisRequest = useRequest(getAllCustomEmojis(), {
    updateKey: refreshToken,
    transformer: emojiSorter
  })
  const accessibleRanksRequest = useRequest(getAccessibleRanks(), { updateKey: refreshToken })
  const isLoading = emojisRequest.isLoading || accessibleRanksRequest.isLoading

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

  const meetsEmojiRequirements = (emoji: PublicCustomEmoji) => {
    if (loginContext.isLoading || !loginContext.initialised || accessibleRanksRequest.data == null) {
      return false
    }

    const currentLevel = loginContext.user?.levelInfo.level ?? 0
    if (currentLevel < emoji.levelRequirement) {
      return false
    }

    if (emoji.whitelistedRanks.length > 0) {
      // user must have at least one rank that is in the list of whitelisted ranks - else they don't meet the requirements
      let hasRank = false
      for (const rankId of emoji.whitelistedRanks) {
        const rankName = accessibleRanksRequest.data.accessibleRanks.find(accessibleRank => accessibleRank.id === rankId)?.name
        if (rankName == null) {
          continue
        } else if (loginContext.hasRank(rankName)) {
          hasRank = true
          break
        }
      }

      if (!hasRank) {
        return false
      }
    }

    return true
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

          <FormControlLabel
            label="Show only eligible emojis"
            sx={{ mb: 1, display: 'block' }}
            control={
              <Checkbox
                checked={showOnlyEligibleEmojis}
                disabled={isLoading}
                onChange={() => setShowOnlyEligibleEmojis(!showOnlyEligibleEmojis)}
              />
            }
          />

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
                  isLoading={isLoading}
                  meetsRequirements={meetsEmojiRequirements(emoji)}
                  showOnlyEligibleEmojis={showOnlyEligibleEmojis}
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
        isLoading={isLoading}
        onCancel={onCancelEdit}
        onChange={onChange}
        onSave={onSave}
        onCheckDuplicateSymbol={onCheckDupliateSymbol}
      />
    </>
  )
}

const disabledTheme = createTheme({
  palette: {
    text: {
      primary: 'grey'
    }
  }
})

type CustomEmojiRowProps = {
  data: EmojiData
  accessibleRanks: PublicRank[]
  isLoading: boolean
  meetsRequirements: boolean
  showOnlyEligibleEmojis: boolean
  onEdit: (id: number) => void
}

function CustomEmojiRow (props: CustomEmojiRowProps) {
  if (props.showOnlyEligibleEmojis && !props.meetsRequirements) {
    return null
  }

  const symbol = `:${props.data.symbol}:`

  return (
    <ThemeProvider theme={props.meetsRequirements ? {} : disabledTheme}>
      <TableRow>
        <TableCell>{props.data.name}</TableCell>
        <TableCell>
          {symbol}
          {!props.isLoading && props.meetsRequirements && <CopyText text={symbol} tooltip="Copy symbol to clipboard" sx={{ ml: 1 }} />}
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
      </TableRow>
    </ThemeProvider>
  )
}
