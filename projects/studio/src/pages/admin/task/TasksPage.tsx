import { MoreVert } from '@mui/icons-material'
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Input, Menu, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField } from '@mui/material'
import { PublicTask } from '@rebel/api-models/public/task/PublicTask'
import { ONE_DAY, ONE_HOUR, ONE_YEAR } from '@rebel/shared/util/datetime'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import RelativeTime from '@rebel/studio/components/RelativeTime'
import TimeSpan from '@rebel/studio/components/Timespan'
import useRequest from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { executeTask, getTaskLogs, getTasks, updateTask } from '@rebel/studio/utility/api'
import { useEffect, useRef, useState } from 'react'

export default function TasksPage () {
  const [updateKey, onUpdate] = useUpdateKey()
  const getTasksRequest = useRequest(getTasks(), { updateKey })

  return (
    <Box>
      <PanelHeader>Tasks {<RefreshButton isLoading={getTasksRequest.isLoading} onRefresh={onUpdate} />}</PanelHeader>
      {getTasksRequest.data != null && <TasksList tasks={getTasksRequest.data.tasks} onUpdate={onUpdate} />}
      <ApiError requestObj={getTasksRequest} />
    </Box>
  )
}

type TasksListProps = {
  tasks: PublicTask[]
  onUpdate: () => void
}

function TasksList (props: TasksListProps) {
  const [taskTypeMenuOpen, setTaskTypeMenuOpen] = useState<string | null>(null)
  const [editingTaskType, setEditingTaskType] = useState<string | null>(null)
  const executeRequest = useRequest(executeTask(taskTypeMenuOpen!), {
    onDemand: true,
    onSuccess: props.onUpdate
  })
  const [viewingLogsForTaskType, setViewingLogsForTaskType] = useState<string | null>(null)
  const menuAnchor = useRef<HTMLElement | null>(null)

  const onClickMenu = (e: React.MouseEvent<HTMLButtonElement>, taskType: string) => {
    setTaskTypeMenuOpen(taskType)
    menuAnchor.current = e.currentTarget
  }
  const onCloseMenu = () => {
    setTaskTypeMenuOpen(null)
    menuAnchor.current = null
  }
  const onClickEdit = () => {
    setEditingTaskType(taskTypeMenuOpen!)
    onCloseMenu()
  }
  const onClickExecute = () => {
    executeRequest.triggerRequest()
    onCloseMenu()
  }
  const onClickOpenLogs = () => {
    setViewingLogsForTaskType(taskTypeMenuOpen!)
    onCloseMenu()
  }
  const onCloseDialog = () => {
    setEditingTaskType(null)
    setViewingLogsForTaskType(null)
  }
  const onUpdate = () => {
    onCloseDialog()
    props.onUpdate()
  }

  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Task</TableCell>
            <TableCell>Interval</TableCell>
            <TableCell>Next run</TableCell>
            <TableCell>Last success</TableCell>
            <TableCell>Last failure</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.tasks.map(task => {
            const nextExecution = (task.lastSuccess ?? task.lastFailure ?? Date.now()) + task.intervalMs
            return (
              <TableRow key={task.taskType}>
                <TableCell>{task.taskType}</TableCell>
                <TableCell><TimeSpan start={0} end={task.intervalMs} maxDepth={1} /></TableCell>
                <TableCell><RelativeTime time={nextExecution} prefix="in " maxDepth={1} /></TableCell>
                <TableCell>{task.lastSuccess != null ? <RelativeTime time={task.lastSuccess} suffix=" ago" /> : 'n/a'}</TableCell>
                <TableCell>{task.lastFailure != null ? <RelativeTime time={task.lastFailure} suffix=" ago" /> : 'n/a'}</TableCell>
                <TableCell>
                  <IconButton onClick={e => onClickMenu(e, task.taskType)}>
                    <MoreVert />
                  </IconButton>
                  <Menu
                    open={taskTypeMenuOpen === task.taskType}
                    onClose={onCloseMenu}
                    anchorEl={menuAnchor.current!}
                  >
                    <MenuItem onClick={onClickEdit}>Edit</MenuItem>
                    <MenuItem disabled={executeRequest.isLoading} onClick={onClickExecute}>Execute {executeRequest.isLoading && <CircularProgress size="24px" />}</MenuItem>
                    <MenuItem onClick={onClickOpenLogs}>Logs</MenuItem>
                  </Menu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <EditTaskDialog
        tasks={props.tasks}
        editingTaskType={editingTaskType}
        onClose={onCloseDialog}
        onUpdate={onUpdate}
      />
      <TaskLogsDialog
        taskType={viewingLogsForTaskType}
        onClose={onCloseDialog}
      />

      <ApiLoading requestObj={executeRequest} />
      <ApiError requestObj={executeRequest} />
    </Box>
  )
}

type EditTaskDialogProps = {
  editingTaskType: string | null
  tasks: PublicTask[]
  onClose: () => void
  onUpdate: () => void
}

function EditTaskDialog (props: EditTaskDialogProps) {
  const [days, changeDays] = useState(0)
  const [hours, changeHours] = useState(0)

  const task = props.tasks.find(t => t.taskType === props.editingTaskType)
  const interval = task?.intervalMs ?? 0
  const newInterval = days * ONE_DAY + hours * ONE_HOUR
  const dayError = days < 0 ? 'Cannot be negative' : newInterval > ONE_YEAR ? 'Too large' : null
  const hourError = hours < 0 ? 'Cannot be negative' : newInterval > ONE_YEAR ? 'Too large' : null

  const updateTaskRequest = useRequest(updateTask({ taskType: task?.taskType ?? '', intervalMs: newInterval }), {
    onDemand: true,
    onSuccess: props.onUpdate
  })

  const onSubmit = () => {
    updateTaskRequest.triggerRequest()
  }

  return (
    <Dialog open={props.editingTaskType != null}>
      <DialogTitle>Edit {props.editingTaskType}</DialogTitle>
      <DialogContent>
        <TextField
          size="small"
          label="Days"
          type="number"
          inputProps={{ min: 0 }}
          sx={{ mr: 2 }}
          defaultValue={Math.floor(interval / ONE_DAY)}
          onChange={e => changeDays(Number(e.target.value))}
          helperText={dayError}
          error={dayError != null}
        />
        <TextField
          size="small"
          label="Hours"
          type="number"
          inputProps={{ min: 0 }}
          defaultValue={Math.floor(interval - Math.floor(interval / ONE_DAY) * ONE_DAY) / ONE_HOUR}
          onChange={e => changeHours(Number(e.target.value))}
          helperText={hourError}
          error={hourError != null}
        />
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Box>
          <ApiError requestObj={updateTaskRequest} hideRetryButton />
        </Box>
        <Box>
          <Button disabled={updateTaskRequest.isLoading || hourError != null || dayError != null} onClick={onSubmit} sx={{ mr: 1 }}>
            {!updateTaskRequest.isLoading ? 'Update' : <CircularProgress size="24px" />}
          </Button>
          <Button onClick={props.onClose}>Close</Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}

type TaskLogsDialogProps = {
  taskType: string | null
  onClose: () => void
}

function TaskLogsDialog (props: TaskLogsDialogProps) {
  const getTaskLogsRequest = useRequest(getTaskLogs(props.taskType!), { onRequest: () => props.taskType == null })

  const onClose = () => {
    getTaskLogsRequest.reset()
    props.onClose()
  }

  return (
    <Dialog open={props.taskType != null} maxWidth="lg">
      <DialogTitle>Task Logs for {props.taskType}</DialogTitle>
      <DialogContent>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Id</TableCell>
              <TableCell>Start time</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Log</TableCell>
              <TableCell>Error</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {getTaskLogsRequest.data?.taskLogs.map(taskLog => {
              return (
                <TableRow>
                  <TableCell>{taskLog.id}</TableCell>
                  <TableCell><RelativeTime time={taskLog.startTime} suffix=" ago" /></TableCell>
                  <TableCell>{taskLog.endTime != null ? <TimeSpan start={taskLog.startTime} end={taskLog.endTime} allowMs /> : 'In progress'}</TableCell>
                  <TableCell>{taskLog.log}</TableCell>
                  <TableCell>{taskLog.errorMessage ?? 'n/a'}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <ApiLoading requestObj={getTaskLogsRequest} />
        <ApiError requestObj={getTaskLogsRequest} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
