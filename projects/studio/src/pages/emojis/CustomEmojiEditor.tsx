import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, Switch, TextField } from '@mui/material'
import { PublicCustomEmoji, PublicCustomEmojiNew, PublicCustomEmojiUpdate } from '@rebel/api-models/public/emoji/PublicCustomEmoji'
import { PublicRank } from '@rebel/api-models/public/rank/PublicRank'
import { ChatMateError } from '@rebel/shared/util/error'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import useRequest from '@rebel/studio/hooks/useRequest'
import { EmojiData } from '@rebel/studio/pages/emojis/CustomEmojiManager'
import RanksSelector from '@rebel/studio/pages/emojis/RanksSelector'
import { updateCustomEmoji, addCustomEmoji } from '@rebel/studio/utility/api'
import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  type: 'new' | 'edit'
  data: EmojiData | null
  accessibleRanks: PublicRank[]
  error: React.ReactNode
  isLoading: boolean
  onChange: (data: EmojiData) => void
  onSave: (data: PublicCustomEmoji) => void
  onCancel: () => void
  onCheckDuplicateSymbol: (symbol: string) => boolean
  onCheckDataChanged: (data: EmojiData) => boolean
}

const DEFAULT_DATA: EmojiData = {
  id: 0,
  name: 'New Emoji',
  symbol: 'emoji',
  canUseInDonationMessage: true,
  imageUrl: '',
  levelRequirement: 0,
  whitelistedRanks: [],
  sortOrder: -1
}

export default function CustomEmojiEditor (props: Props) {
  const [enableWhitelist, setEnableWhitelist] = useState(false)
  const [symbolValidation, setSymbolValidation] = useState<string | null>(null)
  const [levelRequirementValidation, setLevelRequirementValidation] = useState<string | null>(null)

  const { data: editingData, onChange } = props

  const updateRequest = useRequest(updateCustomEmoji({ updatedEmoji: emojiDataToUpdateData(props.data)! }), {
    onDemand: true,
    onSuccess: (data) => props.onSave(data.updatedEmoji)
  })

  const addRequest = useRequest(addCustomEmoji({ newEmoji: emojiDataToNewData(props.data)! }), {
    onDemand: true,
    onSuccess: (data) => props.onSave(data.newEmoji)
  })

  const request = props.type === 'new' ? addRequest : updateRequest

  const isValid = editingData != null &&
    !request.isLoading &&
    symbolValidation == null &&
    levelRequirementValidation == null &&
    !isNullOrEmpty(editingData.imageUrl) &&
    (!enableWhitelist || enableWhitelist && editingData.whitelistedRanks.length > 0) &&
    props.onCheckDataChanged(editingData)

  const setSymbol = (symbol: string) => {
    symbol = symbol.trim()
    onChange({ ...editingData!, symbol })

    if (props.onCheckDuplicateSymbol(symbol)) {
      setSymbolValidation('Symbol already exists.')
    } else if (symbol.includes(':')) {
      setSymbolValidation(`Cannot include the character ':'.`)
    } else if (symbol.length < 1 || symbol.length > 32) {
      setSymbolValidation('Must be between 1 and 32 characters.')
    } else {
      setSymbolValidation(null)
    }
  }

  const setLevelRequirement = (levelRequirement: string) => {
    const num = Number(levelRequirement)
    if (isNaN(num)) {
      return
    }

    onChange({ ...editingData!, levelRequirement: num })

    if (num < 0 || num > 100) {
      setLevelRequirementValidation('Must be between 0 and 100')
    } else if (!Number.isInteger(num)) {
      setLevelRequirementValidation('Must be a whole number.')
    } else {
      setLevelRequirementValidation(null)
    }
  }

  const onSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files == null || files.length === 0) {
      return
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsDataURL
    // reads as base64 encoding, including the `data:` prefix
    const fr = new FileReader()
    fr.onload = () => {
      const data = fr.result as string
      const prefix = 'data:image/png;base64,'
      const imageData = data.substring(prefix.length)
      onChange({ ...editingData!, imageUrl: imageData })
    }
    fr.onerror = () => { throw new ChatMateError() }
    fr.readAsDataURL(files[0])
  }

  const onToggleWhitelist = (e: React.ChangeEvent<HTMLInputElement>) => {
    // disabling the whitelist means an empty whitelist array
    if (!e.target.checked) {
      onChange({ ...editingData!, whitelistedRanks: [] })
    }

    setEnableWhitelist(e.target.checked)
  }

  const onCancel = () => {
    request.reset()
    setEnableWhitelist(false)
    props.onCancel()
  }

  useEffect(() => {
    if (editingData == null) {
      onChange(DEFAULT_DATA)
    } else if (editingData.whitelistedRanks.length > 0) {
      setEnableWhitelist(true)
    }
  }, [editingData, onChange])

  return (
    <Dialog open={props.open} fullWidth sx={{ typography: 'body1' }}>
      <DialogTitle>{props.data == null ? 'Create Emoji' : 'Edit Emoji'}</DialogTitle>
      <DialogContent>
        {editingData == null ?
          <ApiLoading isLoading /> :
          <Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <TextField
                label="Name"
                value={editingData.name}
                disabled={props.isLoading || request.isLoading}
                onChange={e => onChange({ ...editingData, name: e.target.value })}
              />
              <TextField
                label="Symbol"
                value={editingData.symbol}
                disabled={props.isLoading || request.isLoading || props.type !== 'new'}
                onChange={e => setSymbol(e.target.value)}
                error={symbolValidation != null}
                helperText={symbolValidation}
                sx={{ mt: 3 }}
              />
              <TextField
                label="Level Requirement"
                inputMode="numeric"
                value={editingData.levelRequirement}
                disabled={props.isLoading || request.isLoading}
                onChange={e => setLevelRequirement(e.target.value)}
                error={levelRequirementValidation != null}
                helperText={levelRequirementValidation}
                sx={{ mt: 3 }}
              />
              <FormControlLabel
                label="Allow in donation messages"
                sx={{ mt: 2 }}
                control={
                  <Checkbox
                    checked={editingData.canUseInDonationMessage}
                    disabled={props.isLoading || request.isLoading}
                    onChange={e => onChange({ ...editingData, canUseInDonationMessage: e.target.checked })}
                  />
                }
              />
              <FormControl>
                <FormControlLabel
                  label="Whitelist ranks"
                  sx={{ mt: 2 }}
                  control={
                    <Switch
                      disabled={props.isLoading || request.isLoading}
                      checked={enableWhitelist}
                      onChange={onToggleWhitelist}
                    />
                  }
                />
                <Accordion elevation={0} expanded={enableWhitelist}>
                  {/* summary is required, otherwise it breaks the accordion */}
                  <AccordionSummary style={{ minHeight: 0, maxHeight: 0, visibility: 'hidden' }} />
                  <AccordionDetails>
                    <RanksSelector
                      disabled={props.isLoading || request.isLoading}
                      accessibleRanks={props.accessibleRanks}
                      ranks={editingData.whitelistedRanks}
                      onChange={ranks => onChange({ ...editingData, whitelistedRanks: ranks })}
                    />
                    {enableWhitelist && editingData.whitelistedRanks.length === 0 &&
                      <InputLabel sx={{ display: 'contents' }} error>Must select at least 1 rank to whitelist.</InputLabel>
                    }
                  </AccordionDetails>
                </Accordion>
              </FormControl>
              <FormControl sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  {!isNullOrEmpty(editingData.imageUrl) && <img src={editingData.imageUrl.startsWith('http') ? editingData.imageUrl : `data:image/png;base64,${editingData.imageUrl}`} style={{ maxHeight: 32 }} alt="" />}
                </Box>
                <Button disabled={props.isLoading || request.isLoading} component="label" sx={{ mt: 1 }}>
                  <input type="file" hidden accept="image/png" disabled={props.isLoading || request.isLoading} onChange={onSelectImage} />
                  Select image
                </Button>
              </FormControl>
            </Box>
          </Box>
        }

        <ApiLoading isLoading={request.isLoading} />
        <ApiError requestObj={request} hideRetryButton />
      </DialogContent>
      <DialogActions>
        <Button disabled={!isValid} onClick={request.triggerRequest}>
          {props.type === 'new' ? 'Create emoji' : 'Update emoji'}
        </Button>
        <Button onClick={onCancel}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function emojiDataToNewData (data: EmojiData | null): PublicCustomEmojiNew | null {
  if (data == null) {
    return null
  }

  const { imageUrl, ...rest } = data
  return {
    ...rest,
    imageDataUrl: imageUrl
  }
}


function emojiDataToUpdateData (data: EmojiData | null): PublicCustomEmojiUpdate | null {
  if (data == null) {
    return null
  }

  const { imageUrl, ...rest } = data
  return {
    ...rest,
    imageDataUrl: imageUrl
  }
}
