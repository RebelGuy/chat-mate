import { Edit, Public } from '@mui/icons-material'
import { Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Paper, Popover, Stack, SxProps, TextField, Typography } from '@mui/material'
import { PublicUserRank } from '@rebel/api-models/public/rank/PublicUserRank'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { toSentenceCase } from '@rebel/shared/util/text'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import RelativeTime from '@rebel/studio/components/RelativeTime'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import useRequest from '@rebel/studio/hooks/useRequest'
import { PageChangePassword, PageLogin } from '@rebel/studio/pages/navigation'
import { deleteCustomRankName, logout, setCustomRankName } from '@rebel/studio/utility/api'
import React, { CSSProperties, ReactElement, useState } from 'react'
import { useContext } from 'react'
import { useNavigate, generatePath, useLocation } from 'react-router-dom'
import RankHelpers from '@rebel/shared/helpers/RankHelpers'
import { InvalidCustomRankNameError } from '@rebel/shared/util/error'
import { RETURN_URL_QUERY_PARAM } from '@rebel/studio/pages/login/LoginForm'
import Clickable from '@rebel/studio/components/Clickable'

const rankHelpers = new RankHelpers()

export default function UserInfo () {
  const loginContext = useContext(LoginContext)
  const navigate = useNavigate()
  const { pathname: currentPath } = useLocation()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const onLoggedOut = () => {
    loginContext.logout()
    navigate(generatePath('/'))
    setMenuAnchor(null)
  }
  const logoutRequest = useRequest(logout(), { onDemand: true, onDone: onLoggedOut })

  const onChangePassword = () => {
    navigate(PageChangePassword.path)
    setMenuAnchor(null)
  }

  const loginUrl = generatePath(PageLogin.path) + `?${RETURN_URL_QUERY_PARAM}=${currentPath}`
  const isLoggedIn = loginContext.username != null
  if (!isLoggedIn) {
    return <>
      <Alert severity="info">
        You are not currently logged in.
      </Alert>
      <Button onClick={() => navigate(loginUrl)} fullWidth sx={{ marginTop: 1, marginBottom: 1 }}>Login</Button>

      {loginContext.authError != null && <>
        <Alert severity="error">{loginContext.authError}</Alert>
      </>}
    </>
  }

  const isLoading = logoutRequest.isLoading

  return <>
    <Clickable onClick={e => setMenuAnchor(e.currentTarget)} width="40px" margin="auto">
      <Avatar />
    </Clickable>
    <UserName />
    <UserRanks sx={{ mt: 1, mb: 1 }} />

    <Popover
      open={menuAnchor != null}
      anchorEl={menuAnchor}
      onClose={() => setMenuAnchor(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <MenuItem disabled={isLoading} onClick={logoutRequest.triggerRequest}>Log out</MenuItem>
      <MenuItem disabled={isLoading} onClick={onChangePassword}>Change password</MenuItem>
    </Popover>
  </>
}

function UserName () {
  const loginContext = React.useContext(LoginContext)
  const level = loginContext.isLoading ? undefined : (loginContext.user?.levelInfo.level ?? 0)

  return <Box sx={{ textAlign: 'center' }}>
    Hi, <Level level={level} /> <b>{loginContext.username}</b>!
  </Box>
}

function Level (props: { level: number | undefined }) {
  const level = props.level

  if (level == null) {
    return <Box style={{ display: 'inline' }}>
      <CircularProgress style={{ width: 14, height: 14 }} />
    </Box>
  }

  const colour = getLevelColor(level)
  return <Box style={{ display: 'inline', color: colour, fontWeight: 700 }}>{level}</Box>
}

function UserRanks (props: { sx: SxProps }) {
  const loginContext = React.useContext(LoginContext)
  let [selectedRank, setSelectedRank] = useState<PublicUserRank | null>(null)

  const globalRanks = loginContext.allRanks.filter(r => r.streamer == null)
  const streamerRanks = loginContext.allRanks.filter(r => r.streamer != null && r.streamer === loginContext.streamer)
  const ranks = [...globalRanks, ...streamerRanks]

  // reference the loginContext's ranks so that when we update the rank (e.g. by customising the name), the selection automatically changes as well
  selectedRank = selectedRank != null ? ranks.find(r => r.id === selectedRank!.id) ?? null : null

  // have to add up to 12
  const gridLeft = 4
  const gridRight = 12 - gridLeft

  return <Box sx={props.sx}>
    <Box>
      {ranks.map(r => <Rank key={r.id} rank={r} onClick={setSelectedRank} />)}
    </Box>
    {selectedRank != null &&
      <Dialog open>
        <DialogTitle>
          {toSentenceCase(selectedRank!.rank.group)} rank details
        </DialogTitle>
        <DialogContent sx={{ typography: 'body1' }}>
          <Grid container spacing={2}>
            <Grid item xs={gridLeft}>Rank:</Grid><Grid item xs={gridRight}>{toSentenceCase(selectedRank!.rank.displayNameNoun)}</Grid>
            <Grid item xs={gridLeft}>Description:</Grid><Grid item xs={gridRight}>{selectedRank!.rank.description ?? <em>No description.</em>}</Grid>
            <Grid item xs={gridLeft}>Message:</Grid><Grid item xs={gridRight}>{getRankMessage(selectedRank!)}</Grid>
            <Grid item xs={gridLeft}>Active since:</Grid><Grid item xs={gridRight}><RelativeTime time={selectedRank!.issuedAt} /> ago</Grid>
            <Grid item xs={gridLeft}>Expiration:</Grid><Grid item xs={gridRight}>{selectedRank!.expirationTime == null ? 'Never' : <>In <RelativeTime time={selectedRank!.expirationTime} /></>}</Grid>
          </Grid>
          <Box sx={{ mt: 4, display: 'flex' }}>
            {selectedRank!.streamer == null
              ? <>This is a global rank.<Public style={{ marginTop: 2, marginLeft: 4, fontSize: 18 }} /></>
              : <>This rank applies only to streamer {selectedRank!.streamer}.</>
            }
          </Box>

          <CustomiseRank rank={selectedRank} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedRank(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    }
  </Box>
}

type RankProps = {
  rank: PublicUserRank
  onClick: (rank: PublicUserRank) => void
}

function Rank (props: RankProps) {
  const loginContext = useContext(LoginContext)

  const globalSuffix = props.rank.streamer == null ? <Public style={{ fontSize: 18, marginTop: 2, marginLeft: 4 }} /> : ''
  const color = getRankColor(props.rank)

  const isCustomised = props.rank.customRankName != null
  const isCustomisable = loginContext.customisableRanks.includes(props.rank.rank.name)
  const customNameSuffix = isCustomised || isCustomisable ? <Edit style={{ fontSize: 18, marginTop: 2, marginLeft: 4 }} /> : ''

  return (
    <Chip
      onClick={() => props.onClick(props.rank)}
      label={<Box display="flex">{props.rank.customRankName?.trim() ?? toSentenceCase(props.rank.rank.displayNameNoun)}{globalSuffix}{customNameSuffix}</Box>}
      sx={{ p: 0.5, m: 0.5, border: `1px ${color} solid` }}
    />
  )
}

function getLevelColor (level: number): CSSProperties['color'] {
  if (level < 20) {
    return 'grey'
  } else if (level < 40) {
    return 'blue'
  } else if (level < 60) {
    return 'green'
  } else if (level < 80) {
    return 'gold'
  } else if (level < 100) {
    return 'red'
  } else {
    return 'darkred'
  }
}

function getRankColor (rank: PublicUserRank): CSSProperties['color'] {
  switch (rank.rank.group) {
    case 'administration':
      return 'red'
    case 'cosmetic':
      return 'purple'
    case 'donation':
      return 'green'
    case 'punishment':
      return 'black'
    default:
      assertUnreachable(rank.rank.group)
  }
}

function getRankMessage (rank: PublicUserRank): ReactElement {
  if (isNullOrEmpty(rank.message)) {
    return <em>No message.</em>
  }

  const { message, linkInfo } = extractLinkInfo(rank.message)

  return <>
    <Box>{message}</Box>
    {linkInfo.map((info, i) => <Box sx={{ fontSize: 11, mt: 0.5, fontStyle: 'italic' }} key={i}>{info}</Box>)}
  </>
}

// a rank can be transferred multiple times, and the link info message is appended each time.
// link info is returned in ascending time order.
function extractLinkInfo (message: string): { message: string, linkInfo: string[] } {
  const pattern = / \[Added as part of rank transfer link attempt \d+ from user \d+ to user \d+\]/g

  let rest: string | null = null
  let linkInfo: string[] = []
  let match: RegExpExecArray | null

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // matches from left to right, calling multiple times will find next match
    match = pattern.exec(message)
    if (match == null) {
      return {
        message: rest ?? message,
        linkInfo
      }
    } else {
      let thisInfo = match[0]
      linkInfo.push(thisInfo.substring(2, thisInfo.length - 1))

      if (rest == null) {
        rest = message.substring(0, match.index)
      }
    }
  }
}

type CustomiseRankProps = {
  rank: PublicUserRank
}

function CustomiseRank (props: CustomiseRankProps) {
  const loginContext = useContext(LoginContext)
  const [name, setName] = useState(props.rank.customRankName ?? '')

  // after changing the rank name, we trigger a refresh of the user's ranks. we don't want to enable controls
  // until the initial rank name change AND the refresh have succeeded. the dependency here is the rank refresh.
  const [isLoadingDependency, setIsLoadingDependency] = useState(false)

  const setCustomRankNameRequest = useRequest(setCustomRankName({ rank: props.rank.rank.name, name: name, isActive: true }), {
    onDemand: true,
    onRequest: () => setIsLoadingDependency(true),
    onSuccess: () => loginContext.refreshData('userRanks').then(_ => setIsLoadingDependency(false)),
    onError: () => setIsLoadingDependency(false)
  })
  const deleteCustomRankNameRequest = useRequest(deleteCustomRankName(props.rank.rank.name), {
    onDemand: true,
    onRequest: () => setIsLoadingDependency(true),
    onSuccess: () => loginContext.refreshData('userRanks').then(_ => {
      setIsLoadingDependency(false)
      setName('')
    }),
    onError: () => setIsLoadingDependency(false)
  })

  const isCustomised = props.rank.customRankName != null
  const isCustomisable = loginContext.customisableRanks.includes(props.rank.rank.name)

  if (!isCustomised && !isCustomisable) {
    return null
  }

  const isLoading = setCustomRankNameRequest.isLoading || deleteCustomRankNameRequest.isLoading || isLoadingDependency

  let validationError: string | null = null
  if (name.length > 0) {
    try {
      rankHelpers.validateCustomRankName(name)
    } catch (e: any) {
      if (e instanceof InvalidCustomRankNameError) {
        validationError = e.message
      } else {
        throw e
      }
    }
  }

  return (
    <Box sx={{ mt: 4 }}>
      <h3>Customisation</h3>
      <Typography>You can customise the name of the rank here.</Typography>
      <Box sx={{ mt: 1 }}>
        <TextField
          placeholder="Enter a custom rank name"
          value={name}
          error={validationError != null}
          helperText={validationError}
          onChange={e => setName(e.target.value)}
          disabled={isLoading || !isCustomisable}
        />
      </Box>
      <Box sx={{ mt: 1 }}>
        {isCustomisable &&
          <Button
            onClick={setCustomRankNameRequest.triggerRequest}
            disabled={isLoading || name === (props.rank.customRankName ?? '') || validationError != null || name.length === 0}
            sx={{ mr: 1 }}
          >
            Save name
          </Button>
        }
        {isCustomised &&
          <Button
            onClick={deleteCustomRankNameRequest.triggerRequest}
            disabled={isLoading}
          >
            Delete name
          </Button>
        }
      </Box>
      <Box sx={{ mt: 1 }}>
        <ApiLoading requestObj={[setCustomRankNameRequest, deleteCustomRankNameRequest]} isLoading={isLoadingDependency} />
        <ApiError requestObj={[setCustomRankNameRequest, deleteCustomRankNameRequest]} hideRetryButton />
      </Box>
    </Box>
  )
}
