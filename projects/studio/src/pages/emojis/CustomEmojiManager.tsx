import { DragEvent, ReactNode, useContext, useRef, useState } from 'react'
import { PublicCustomEmoji } from '@rebel/api-models/public/emoji/PublicCustomEmoji'
import { getAccessibleRanks, getAllCustomEmojis, updateCustomEmojiSortOrder } from '@rebel/studio/utility/api'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { PublicRank } from '@rebel/api-models/public/rank/PublicRank'
import { compareArrays, sortBy } from '@rebel/shared/util/arrays'
import RequireRank from '@rebel/studio/components/RequireRank'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { Alert, Box, Button, Card, Checkbox, CircularProgress, createTheme, Drawer, FormControlLabel, Grow, IconButton, Slide, Stack, SxProps, Table, TableBody, TableCell, TableHead, TableRow, ThemeProvider, Typography } from '@mui/material'
import TextWithHelp from '@rebel/studio/components/TextWithHelp'
import CustomEmojiEditor from '@rebel/studio/pages/emojis/CustomEmojiEditor'
import RanksDisplay from '@rebel/studio/pages/emojis/RanksDisplay'
import { Close, Delete, Done, DragHandle, Edit, Save } from '@mui/icons-material'
import CopyText from '@rebel/studio/components/CopyText'
import useRequest from '@rebel/studio/hooks/useRequest'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { SafeOmit } from '@rebel/shared/types'
import { createPortal } from 'react-dom'
import useMap from '@rebel/studio/hooks/useMap'
import { PanelContext } from '@rebel/studio/pages/main/MainView'
import useMemState from '@rebel/studio/hooks/useMemState'
import useAnimation from '@rebel/studio/hooks/useAnimation'
import { clamp } from '@rebel/shared/util/math'

export type EmojiData = SafeOmit<PublicCustomEmoji, 'isActive' | 'version'>

type Eligibility = {
  meetsLevelRequirement: boolean
  meetsRankRequirement: boolean
}

export default function CustomEmojiManager () {
  const loginContext = useContext(LoginContext)
  const panel = useContext(PanelContext)
  const isLoggedIn = loginContext.username != null
  const [editingEmoji, setEditingEmoji] = useState<EmojiData | null>(null)
  const [editingError, setEditingError] = useState<ReactNode>(null)
  const [openEditor, setOpenEditor] = useState<boolean>(false)
  const [editingType, setEditingType] = useState<'new' | 'edit'>('new')
  const [showOnlyEligibleEmojis, setShowOnlyEligibleEmojis] = useState(!loginContext.hasRank('owner'))
  const [dragging, setDragging] = useState<PublicCustomEmoji | null>(null)
  const [hoveringOver, setHoveringOver] = useState<PublicCustomEmoji | null>(null)
  const [mouseX, prevMouseX, setMouseX] = useMemState<number | null>(null, null)
  const [mouseY, prevMouseY, setMouseY] = useMemState<number | null>(null, null)
  const [animationKey, updateAnimationKey] = useUpdateKey()
  const headerRef = useRef<HTMLElement | null>(null)
  const sortOrderMap = useMap<PublicCustomEmoji, number>() // used to override the sort orders while editing
  const [refreshToken, updateRefreshToken] = useUpdateKey()
  const emojisRequest = useRequest(getAllCustomEmojis(), {
    updateKey: refreshToken,
    onSuccess: data => {
      replaceSortOrderKeys(data.emojis)
      cleanUpSortOrderMap()
    }
  })
  const accessibleRanksRequest = useRequest(getAccessibleRanks(), { updateKey: refreshToken })
  const updateCustomEmojiSortOrderRequest = useRequest(updateCustomEmojiSortOrder({ sortOrders: sortOrderMap.toRecord(e => e.id) }), { onDemand: true })

  const isLoading = emojisRequest.isLoading || accessibleRanksRequest.isLoading || updateCustomEmojiSortOrderRequest.isLoading

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

  const onCheckDuplicateSymbol = (symbol: string) => {
    return emojisRequest.data!.emojis.find(emoji => {
      return emoji.id !== editingEmoji?.id && emoji.symbol === symbol
    }) != null
  }

  const onCheckDataChanged = (data: EmojiData) => {
    const previousData = emojisRequest.data!.emojis.find(emoji => emoji.id === data.id)
    if (previousData == null) {
      return true
    } else {
      return compareEmojis(data, previousData)
    }
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

  function getSortOrder (emoji: PublicCustomEmoji) {
    return sortOrderMap.get(emoji) ?? emoji.sortOrder
  }

  function onDragMove (e: DragEvent) {
    setMouseX(e.clientX)
    setMouseY(e.clientY)
  }

  // note we have to pass the params into the animation function, else the `scrollAnimation` function will keep an outdated version in scope
  const nextParams = { mouseX, mouseY, prevMouseX, prevMouseY }
  useAnimation(scrollAnimation, nextParams)

  // buttery smooth *chefs kiss*
  function scrollAnimation (t: number, delta: number, params: typeof nextParams) {
    if (params.mouseX == null || params.mouseY == null || params.prevMouseX == null || params.prevMouseY == null || panel == null) {
      return
    } else if (params.mouseY === 0) {
      return
    }

    const panelRect = panel.getBoundingClientRect()
    const threshold = 100
    const maxSpeed = 20

    if (params.mouseY - panelRect.y < threshold) {
      const distToThreshold = clamp(threshold - (params.mouseY - panelRect.y), 0, threshold)
      panel.scrollBy({ top: -maxSpeed * distToThreshold / threshold })
      updateAnimationKey()
    } else if (panelRect.bottom - params.mouseY < threshold) {
      const distToThreshold = clamp(threshold - (panelRect.bottom - params.mouseY), 0, threshold)
      panel.scrollBy({ top: maxSpeed * distToThreshold / threshold })
      updateAnimationKey()
    }
  }

  function onDragEnd () {
    setMouseX(null)
    setMouseY(null)

    if (dragging != null && hoveringOver != null) {
      const placeAbove = getSortOrder(dragging) > getSortOrder(hoveringOver)
      const newSortOrder = getSortOrder(hoveringOver)

      if (placeAbove) {
        // increase the sort order of all elements above the hoveringOver emoji (inclusive), up to the dragging element.
        // then set the dragging element's sort order to the older hoveringOver emoji's sort order
        for (const emoji of emojisRequest.data!.emojis) {
          if (getSortOrder(emoji) >= getSortOrder(hoveringOver) && getSortOrder(emoji) < getSortOrder(dragging)) {
            sortOrderMap.set(emoji, getSortOrder(emoji) + 1)
          }
        }

      } else {
        // decrease the sort order of all elements below the dragging element, up to the hoveringOver element (inclusive)
        // set the dragging element's sort order to the older hoveringOver emoji's sort order
        for (const emoji of emojisRequest.data!.emojis) {
          if (getSortOrder(emoji) <= getSortOrder(hoveringOver) && getSortOrder(emoji) > getSortOrder(dragging)) {
            sortOrderMap.set(emoji, getSortOrder(emoji) - 1)
          }
        }
      }

      sortOrderMap.set(dragging, newSortOrder)
      cleanUpSortOrderMap()
    }

    setDragging(null)
    setHoveringOver(null)
  }

  async function onSaveOrder () {
    const result = await updateCustomEmojiSortOrderRequest.triggerRequest()

    if (result.type === 'success') {
      await emojisRequest.triggerRequest()
    }
  }

  function onDiscardOrder () {
    sortOrderMap.clear()
  }

  function cleanUpSortOrderMap () {
    sortOrderMap.clear((emoji, sortOrder) => emoji.sortOrder === sortOrder)
  }

  function replaceSortOrderKeys (emojis: PublicCustomEmoji[]) {
    const knownIds = emojis.map(e => e.id)
    sortOrderMap.clear(e => !knownIds.includes(e.id))
    sortOrderMap.replaceKeys(e1 => emojis.find(e2 => e1.id === e2.id)!)
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
            sx={{ mb: 1, display: 'block', width: 'fit-content' }}
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
            size="small"
            style={{
              transform: 'translateY(-5px)',

              // make sure the popover card doesn't hide any rows
              paddingBottom: sortOrderMap.size > 0 ? 30 : undefined
            }}
          >
            <TableHead ref={(r) => headerRef.current = r}>
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
              {sortBy(emojisRequest.data.emojis, getSortOrder).map(emoji =>
                <CustomEmojiRow
                  key={emoji.id}
                  data={emoji}
                  accessibleRanks={accessibleRanksRequest.data?.accessibleRanks ?? []}
                  isLoading={isLoading}
                  meetsRequirements={meetsEmojiRequirements(emoji)}
                  showOnlyEligibleEmojis={isLoggedIn ? showOnlyEligibleEmojis : false}
                  isDraggingOver={dragging != null && dragging !== emoji && hoveringOver === emoji}
                  isDragging={dragging != null && dragging === emoji}
                  showHitboxAbove={dragging != null && getSortOrder(emojisRequest.data!.emojis.find(e => e === dragging)!) > getSortOrder(emoji)}
                  headerElement={headerRef.current!}
                  panelElement={panel}
                  updateKey={animationKey}
                  onEdit={() => onEdit(emoji.id)}
                  onDragStart={() => setDragging(emoji)}
                  onDragMove={onDragMove}
                  onDragEnd={onDragEnd}
                  onMouseEnter={() => setHoveringOver(emoji)}
                  onMouseLeave={() => setHoveringOver(e => e === emoji ? null : e)}
                />
              )}
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
        onCheckDuplicateSymbol={onCheckDuplicateSymbol}
        onCheckDataChanged={onCheckDataChanged}
      />

      <Grow
        in={sortOrderMap.size > 0}
        style={{
          position: 'fixed',
          bottom: 10,
          background: 'rgb(240, 240, 240)',
          left: 0,
          right: 0,
          width: 390,
          margin: 'auto'
        }}
      >
        <Card style={{ padding: 8 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography display="inline">
              One or more emojis have been re-ordered.
            </Typography>
            {!updateCustomEmojiSortOrderRequest.isLoading ? (
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              <IconButton disabled={isLoading} onClick={onSaveOrder}>
                <Save />
              </IconButton>
            ) : <CircularProgress size="24px" />}
            <IconButton disabled={isLoading} onClick={onDiscardOrder}>
              <Delete />
            </IconButton>
          </Stack>
          <ApiError hideRetryButton requestObj={updateCustomEmojiSortOrderRequest} />
        </Card>
      </Grow>
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
  isDraggingOver: boolean
  isDragging: boolean
  showHitboxAbove: boolean
  headerElement: HTMLElement
  panelElement: HTMLElement
  updateKey: number // so that the row drop marker updates while we are scrolling [highly inefficient!]
  onEdit: () => void
  onDragStart: () => void
  onDragMove: (e: DragEvent) => void
  onDragEnd: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function CustomEmojiRow (props: CustomEmojiRowProps) {
  const [canDrag, setCanDrag] = useState(false)
  const ref = useRef<HTMLElement | null>(null)

  const { meetsLevelRequirement, meetsRankRequirement } = props.meetsRequirements
  const isEligible = meetsLevelRequirement && meetsRankRequirement
  if (props.showOnlyEligibleEmojis && !isEligible) {
    return null
  }

  const symbol = `:${props.data.symbol}:`

  // the whole row can be dragged only via the drag handle
  function onMouseEnterDragHandle (): void {
    setCanDrag(true)
  }

  function onMouseLeaveDragHandle (): void {
    setCanDrag(false)
  }

  let dropIndicatorTop: number | null = null
  if (props.isDraggingOver && ref.current != null) {
    if (props.showHitboxAbove) {
      dropIndicatorTop = ref.current.getBoundingClientRect().top
    } else {
      dropIndicatorTop = ref.current.getBoundingClientRect().bottom
    }

    const headerHeight = props.headerElement.getBoundingClientRect().height
    const panelTop = props.panelElement.getBoundingClientRect().top
    if (dropIndicatorTop < (panelTop + headerHeight)) {
      // don't show if it's behind the sticky panel header
      dropIndicatorTop = null
    } else if (dropIndicatorTop > props.panelElement.getBoundingClientRect().bottom) {
      // don't show if it's beyond the panel boundaries
      dropIndicatorTop = null
    }
  }

  // we render a separate box as the drag-drop indicator so that it doesn't interfere with the layout
  return (
    <>
      {dropIndicatorTop && createPortal(
        <Box
          style={{
            height: 2,
            width: ref.current!.getBoundingClientRect().width,
            background: 'green',
            position: 'absolute',
            top: dropIndicatorTop,
            left: ref.current!.getBoundingClientRect().left
          }}
        />, document.body!)
      }

      <ThemeProvider theme={isEligible ? {} : disabledTheme}>
        <TableRow
          ref={r => ref.current = r}
          draggable={canDrag}
          onDragStart={props.onDragStart}
          onDragCapture={props.onDragMove}
          onDragEnd={props.onDragEnd}
          onDragEnter={props.onMouseEnter}
          onDragExit={props.onMouseLeave}
          style={{ opacity: props.isDragging ? 0.2 : undefined }}
        >
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
              {!isNullOrEmpty(props.data.imageUrl) && <img src={props.data.imageUrl.startsWith('http') ? props.data.imageUrl : `data:image/png;base64,${props.data.imageUrl}`} style={{ maxHeight: 32 }} alt="" />}
            </div>
          </TableCell>
          <RequireRank owner>
            <TableCell>
              <IconButton disabled={props.isLoading} onClick={() => props.onEdit()}>
                <Edit />
              </IconButton>
              <IconButton disabled={props.isLoading} onMouseEnter={onMouseEnterDragHandle} onMouseLeave={onMouseLeaveDragHandle}>
                <DragHandle />
              </IconButton>
            </TableCell>
          </RequireRank>
        </TableRow>
      </ThemeProvider>
    </>
  )
}

function compareEmojis (data: EmojiData, previousData: EmojiData) {
  // i would love to put it on the next line but then vscode grey out the whole thing : --   |
  return data.name !== previousData.name ||
    data.symbol !== previousData.symbol ||
    data.levelRequirement !== previousData.levelRequirement ||
    data.canUseInDonationMessage !== previousData.canUseInDonationMessage ||
    data.imageUrl !== previousData.imageUrl ||
    !compareArrays(sortBy(data.whitelistedRanks, x => x), sortBy(previousData.whitelistedRanks, x => x))
}
