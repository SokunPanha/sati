/** Open/close state of the app-wide bottom sheets (mounted once in app.vue). */
const state = reactive({
  capture: false,
  captureMode: 'task' as 'task' | 'reminder',
  /** reminder being edited in the capture sheet (null = new) */
  reminderId: null as string | null,
  /** text to start a new task with (e.g. an idea from a mind map) */
  captureTitle: '',
  sort: false,
  /** edit a single task instead of walking the inbox */
  sortTaskId: null as string | null,
  profiles: false,
  taskActions: false,
  taskId: null as string | null
})

export function useSheets() {
  function openCapture(mode: 'task' | 'reminder' = 'task', reminderId: string | null = null, title = '') {
    state.captureMode = mode
    state.reminderId = reminderId
    state.captureTitle = title
    state.capture = true
  }
  function openSort(taskId: string | null = null) {
    state.sortTaskId = taskId
    state.sort = true
  }
  function openTask(taskId: string) {
    state.taskId = taskId
    state.taskActions = true
  }
  function closeAll() {
    state.capture = false
    state.sort = false
    state.profiles = false
    state.taskActions = false
  }
  return { sheets: state, openCapture, openSort, openTask, closeAll }
}
