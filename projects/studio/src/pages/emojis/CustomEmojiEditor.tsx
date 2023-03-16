import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, InputLabel, Switch, TextField } from '@mui/material'
import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { EmojiData } from '@rebel/studio/pages/emojis/CustomEmojiManager'
import RanksSelector from '@rebel/studio/pages/emojis/RanksSelector'
import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  data: EmojiData | null
  accessibleRanks: PublicRank[]
  error: React.ReactNode
  isLoading: boolean
  onSave: (data: EmojiData) => void
  onCancel: () => void
  onCheckDuplicateSymbol: (symbol: string) => boolean
}

const DEFAULT_DATA: EmojiData = {
  id: 0,
  name: 'New Emoji',
  symbol: 'emoji',
  canUseInDonationMessage: true,
  imageData: '',
  levelRequirement: 0,
  whitelistedRanks: []
}

export default function CustomEmojiEditor (props: Props) {
  const [editingData, setEditingData] = useState<EmojiData>(props.data ?? DEFAULT_DATA)
  const [enableWhitelist, setEnableWhitelist] = useState(false)
  const [symbolValidation, setSymbolValidation] = useState<string | null>(null)
  const [levelRequirementValidation, setLevelRequirementValidation] = useState<string | null>(null)

  const isValid =
    symbolValidation == null &&
    levelRequirementValidation == null &&
    !isNullOrEmpty(editingData.imageData) &&
    (!enableWhitelist || enableWhitelist && editingData.whitelistedRanks.length > 0)

  const setSymbol = (symbol: string) => {
    symbol = symbol.trim()
    setEditingData({ ...editingData, symbol })

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
    setEditingData({ ...editingData, levelRequirement: num })

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
      setEditingData({ ...editingData, imageData })
    }
    fr.onerror = () => { throw new Error() }
    fr.readAsDataURL(files[0])
  }

  const onToggleWhitelist = (e: React.ChangeEvent<HTMLInputElement>) => {
    // disabling the whitelist means an empty whitelist array
    if (!e.target.checked) {
      setEditingData({ ...editingData, whitelistedRanks: [] })
    }

    setEnableWhitelist(e.target.checked)
  }

  useEffect(() => {
    setEditingData(props.data ?? DEFAULT_DATA)
  }, [props.data])

  return (
    <Dialog open={props.open} fullWidth sx={{ typography: 'body1' }}>
      <DialogTitle>{props.data == null ? 'Create Emoji' : 'Edit Emoji'}</DialogTitle>
      <DialogContent>
        <Box>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <TextField
              label="Name"
              value={editingData.name}
              disabled={props.isLoading}
              onChange={e => setEditingData({ ...editingData, name: e.target.value })}
            />
            {props.data == null &&
              <TextField
                label="Symbol"
                value={editingData.symbol}
                disabled={props.isLoading}
                onChange={e => setSymbol(e.target.value)}
                error={symbolValidation != null}
                helperText={symbolValidation}
                sx={{ mt: 3 }}
              />
            }
            <TextField
              label="Level Requirement"
              inputMode="numeric"
              value={editingData.levelRequirement}
              disabled={props.isLoading}
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
                  disabled={props.isLoading}
                  onChange={e => setEditingData({ ...editingData, canUseInDonationMessage: e.target.checked })}
                />
              }
            />
            <FormControl>
              <FormControlLabel
                label="Whitelist ranks"
                sx={{ mt: 2 }}
                control={
                  <Switch
                    disabled={props.isLoading}
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
                    disabled={props.isLoading}
                    accessibleRanks={props.accessibleRanks}
                    ranks={editingData.whitelistedRanks}
                    onChange={ranks => setEditingData({ ...editingData, whitelistedRanks: ranks })}
                  />
                  {enableWhitelist && editingData.whitelistedRanks.length === 0 &&
                    <InputLabel sx={{ display: 'contents' }} error>Must select at least 1 rank to whitelist.</InputLabel>
                  }
                </AccordionDetails>
              </Accordion>
            </FormControl>
            <FormControl sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                {!isNullOrEmpty(editingData.imageData) && <img src={`data:image/png;base64,${editingData.imageData}`} style={{ maxHeight: 32 }} alt="" />}
              </Box>
              <Button disabled={props.isLoading} component="label" sx={{ mt: 1 }}>
                <input type="file" hidden accept="image/png" disabled={props.isLoading} onChange={onSelectImage} />
                Select image
              </Button>
            </FormControl>
          </Box>
        </Box>
        {props.error &&
          <Alert severity="error" sx={{ mt: 2 }}>{props.error}</Alert>
        }
      </DialogContent>
      <DialogActions>
        <Button disabled={!isValid || props.isLoading} onClick={() => props.onSave(editingData)}>
          {props.data == null ? 'Create emoji' : 'Update emoji'}
        </Button>
        <Button onClick={() => props.onCancel()}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
