import { callCloudFunction } from './cloudbase'

const FUNCTION_NAME = 'dataImportApi'

function callImport(action, payload = {}) {
  return callCloudFunction(
    FUNCTION_NAME,
    action,
    payload
  )
}

export const dataImportApi = {
  readiness() {
    return callImport('readiness')
  },

  backfillBusinessCodes() {
    return callImport('backfillBusinessCodes')
  },

  validateImport(payload) {
    return callImport(
      'validateImport',
      payload
    )
  },

  commitImport(payload) {
    return callImport(
      'commitImport',
      payload
    )
  },

  listJobs() {
    return callImport('listImportJobs')
  },

  getJob(id) {
    return callImport('getImportJob', { id })
  },

  rollback(id) {
    return callImport('rollbackImport', { id })
  }
}
