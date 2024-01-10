import { ReactNode, useContext, useState } from 'react'
import { PublicCustomEmoji } from '@rebel/api-models/public/emoji/PublicCustomEmoji'
import { getAccessibleRanks, getAllCustomEmojis } from '@rebel/studio/utility/api'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { PublicRank } from '@rebel/api-models/public/rank/PublicRank'
import { sortBy } from '@rebel/shared/util/arrays'
import RequireRank from '@rebel/studio/components/RequireRank'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { Alert, Box, Button, Checkbox, createTheme, FormControlLabel, IconButton, SxProps, Table, TableBody, TableCell, TableHead, TableRow, ThemeProvider } from '@mui/material'
import TextWithHelp from '@rebel/studio/components/TextWithHelp'
import CustomEmojiEditor from '@rebel/studio/pages/emojis/CustomEmojiEditor'
import { GetCustomEmojisResponse } from '@rebel/api-models/schema/emoji'
import RanksDisplay from '@rebel/studio/pages/emojis/RanksDisplay'
import { Close, Done, Edit } from '@mui/icons-material'
import CopyText from '@rebel/studio/components/CopyText'
import useRequest, { SuccessfulResponseData } from '@rebel/studio/hooks/useRequest'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'

export type EmojiData = Omit<PublicCustomEmoji, 'isActive' | 'version'>

type Eligibility = {
  meetsLevelRequirement: boolean
  meetsRankRequirement: boolean
}

const emojiSorter = (data: SuccessfulResponseData<GetCustomEmojisResponse>) => ({ emojis: sortBy(data.emojis, e => e.id)})

export default function CustomEmojiManager () {
  const loginContext = useContext(LoginContext)
  const isLoggedIn = loginContext.username != null
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

  const meetsEmojiRequirements = (emoji: PublicCustomEmoji): Eligibility => {
    if (!isLoggedIn) {
      return {
        meetsLevelRequirement: true,
        meetsRankRequirement: true
      }
    }

    if (accessibleRanksRequest.data == null) {
      return {
        meetsLevelRequirement: false,
        meetsRankRequirement: false
      }
    }

    let meetsLevelRequirement = true
    let meetsRankRequirement = true

    const currentLevel = loginContext.user?.levelInfo.level ?? 0
    if (currentLevel < emoji.levelRequirement) {
      meetsLevelRequirement = false
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
        meetsRankRequirement = false
      }
    }

    return { meetsLevelRequirement, meetsRankRequirement }
  }

  const header = <PanelHeader>Emojis {<RefreshButton isLoading={emojisRequest.isLoading} onRefresh={updateRefreshToken} />}</PanelHeader>

  const streamer = loginContext.allStreamers.find(s => s.username === loginContext.streamer)
  if (streamer == null) {
    return <>
      {header}
      <Alert severity="error">Invalid streamer selected.</Alert>
    </>
  }

  return (
    <>
      {header}
      {emojisRequest.data != null &&
        <Box>
          <RequireRank owner>
            <Button
              disabled={isLoading}
              onClick={() => onEdit(null)}
              sx={{ mb: 1 }}
            >
              Create new emoji
            </Button>
          </RequireRank>

          {isLoggedIn && <FormControlLabel
            label="Show only eligible emojis"
            sx={{ mb: 1, display: 'block', width: 'fit-content'  }}
            control={
              <Checkbox
                checked={showOnlyEligibleEmojis}
                disabled={isLoading}
                onChange={() => setShowOnlyEligibleEmojis(!showOnlyEligibleEmojis)}
              />
            }
          />}

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
                  showOnlyEligibleEmojis={isLoggedIn ? showOnlyEligibleEmojis : false}
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

const ineligibilityOutline: SxProps = {
  border: 'red 2px dotted',
  borderRadius: 2,
  width: 'fit-content',
  padding: 1
}

type CustomEmojiRowProps = {
  data: EmojiData
  accessibleRanks: PublicRank[]
  isLoading: boolean
  meetsRequirements: Eligibility
  showOnlyEligibleEmojis: boolean
  onEdit: (id: number) => void
}

function CustomEmojiRow (props: CustomEmojiRowProps) {
  const { meetsLevelRequirement, meetsRankRequirement } = props.meetsRequirements
  const isEligible = meetsLevelRequirement && meetsRankRequirement
  if (props.showOnlyEligibleEmojis && !isEligible) {
    return null
  }

  const symbol = `:${props.data.symbol}:`

  return (
    <ThemeProvider theme={isEligible ? {} : disabledTheme}>
      <TableRow>
        <TableCell>{props.data.name}</TableCell>
        <TableCell>
          {symbol}
          {isEligible && <CopyText text={symbol} tooltip="Copy symbol to clipboard" sx={{ ml: 1 }} />}
        </TableCell>
        <TableCell>
          <Box sx={!meetsLevelRequirement ? ineligibilityOutline : undefined}>
            {props.data.levelRequirement}
          </Box>
        </TableCell>
        <TableCell>{props.data.canUseInDonationMessage ? <Done /> : <Close />}</TableCell>
        <TableCell>
          <Box sx={!meetsRankRequirement ? ineligibilityOutline : undefined}>
            <RanksDisplay ranks={props.data.whitelistedRanks} accessibleRanks={props.accessibleRanks} />
          </Box>
        </TableCell>
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
