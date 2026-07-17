<template>
  <div class="data-import-page">
    <PageHeader
      title="数据导入"
      description="使用标准 Excel 模板和图片 ZIP，批量校验、预览、导入并保留可回滚记录。"
    >
      <el-button :loading="readinessLoading" @click="loadReadiness">
        检查环境
      </el-button>
    </PageHeader>

    <el-alert
      v-if="readiness && !readiness.collections?.importJobs?.ready"
      title="还需要创建 importJobs 集合"
      description="请在 CloudBase 数据库中新建 importJobs 空集合，并设置为所有用户不可读写，然后部署 dataImportApi。"
      type="warning"
      :closable="false"
      show-icon
      class="import-alert"
    />

    <el-alert
      v-else-if="readinessError"
      :title="readinessError"
      type="error"
      :closable="false"
      show-icon
      class="import-alert"
    />

    <div v-if="readiness?.missingCodeTotal > 0" class="legacy-code-alert">
      <div>
        <strong>旧数据中有 {{ readiness.missingCodeTotal }} 条缺少业务编码</strong>
        <span>图鉴编码、商品 SKU 和横幅编码是批量更新的唯一依据。可以自动补全，也可以在各管理页面手工填写更易读的编码。</span>
      </div>
      <el-button :loading="backfillLoading" @click="backfillCodes">自动补全旧编码</el-button>
    </div>

    <el-card shadow="never" class="panel-card import-workspace">
      <div class="import-section-head">
        <div>
          <strong>1. 选择导入类型</strong>
          <span>正式导入顺序：图鉴 → 商品 → 横幅 → 节日</span>
        </div>
        <a class="master-template-link" href="/import-templates/花予数据导入总模板.xlsx" download>
          下载总模板
        </a>
      </div>

      <div class="import-type-grid">
        <div
          v-for="option in typeOptions"
          :key="option.value"
          :class="['import-type-card', importType === option.value ? 'is-active' : '']"
          role="button"
          tabindex="0"
          @click="selectType(option.value)"
          @keyup.enter="selectType(option.value)"
        >
          <strong>{{ option.label }}</strong>
          <span>{{ option.description }}</span>
          <a :href="option.template" download @click.stop>下载模板</a>
        </div>
      </div>

      <el-divider />

      <div class="import-section-head">
        <div>
          <strong>2. 选择数据文件与图片</strong>
          <span>单次最多 100 行；模板第 5 行是示例，请替换或删除。</span>
        </div>
      </div>

      <div class="file-grid">
        <div class="file-panel">
          <div class="file-panel__title">Excel / CSV 数据</div>
          <div class="file-panel__description">支持 .xlsx、.xls、.csv，自动识别“导入数据”工作表。</div>
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            accept=".xlsx,.xls,.csv"
            :on-change="handleWorkbookChange"
          >
            <el-button type="primary">选择数据文件</el-button>
          </el-upload>
          <div v-if="workbookFileName" class="selected-file">
            <span>{{ workbookFileName }}</span>
            <small>{{ parsedRows.length }} 行</small>
          </div>
        </div>

        <div class="file-panel" :class="{ 'is-disabled': !schema.imageFileNameField }">
          <div class="file-panel__title">图片 ZIP</div>
          <div class="file-panel__description">
            {{ schema.imageFileNameField ? 'ZIP 内图片文件名需与 Excel 完全一致；支持 JPG、PNG、WEBP。' : '节日数据不需要图片 ZIP。' }}
          </div>
          <el-upload
            :disabled="!schema.imageFileNameField"
            :auto-upload="false"
            :show-file-list="false"
            accept=".zip"
            :on-change="handleZipChange"
          >
            <el-button :disabled="!schema.imageFileNameField">选择图片 ZIP</el-button>
          </el-upload>
          <div v-if="zipFileName" class="selected-file">
            <span>{{ zipFileName }}</span>
            <small>{{ imageEntries.size }} 张图片</small>
          </div>
        </div>
      </div>

      <div class="import-options">
        <el-form label-position="top">
          <div class="form-grid form-grid--three">
            <el-form-item label="重复编码处理">
              <el-select v-model="duplicateMode" @change="clearValidation">
                <el-option label="按编码更新旧数据" value="upsert" />
                <el-option label="跳过数据库已有数据" value="skip" />
                <el-option label="发现重复立即报错" value="abort" />
              </el-select>
              <div class="form-tip">空白单元格不会清空旧字段；图片未填写时保留旧图。</div>
            </el-form-item>

            <el-form-item label="图片完整性">
              <el-switch v-model="requireImages" :disabled="!schema.imageFileNameField" @change="clearValidation" />
              <div class="form-tip">开启后，新建图鉴、商品或横幅必须匹配图片或填写 FileID。</div>
            </el-form-item>

            <el-form-item label="导入备注">
              <el-input v-model="note" maxlength="80" placeholder="例如 2026年夏季首批正式数据" />
            </el-form-item>
          </div>
        </el-form>
      </div>

      <div class="import-actions">
        <el-button @click="resetCurrent">清空当前文件</el-button>
        <el-button
          type="primary"
          :loading="validating"
          :disabled="!parsedRows.length"
          @click="validateCurrent"
        >
          校验并预览
        </el-button>
      </div>
    </el-card>

    <el-card v-if="validation" shadow="never" class="panel-card validation-panel">
      <div class="import-section-head">
        <div>
          <strong>3. 校验结果</strong>
          <span>只有错误数为 0 才能执行导入。警告不会阻止导入。</span>
        </div>
        <StatusDot
          :text="validation.stats.invalid ? '存在错误' : '可以导入'"
          :type="validation.stats.invalid ? 'danger' : 'success'"
        />
      </div>

      <div class="import-stat-grid">
        <div class="import-stat"><span>总行数</span><strong>{{ validation.stats.total }}</strong></div>
        <div class="import-stat is-success"><span>待新增</span><strong>{{ validation.stats.create }}</strong></div>
        <div class="import-stat is-primary"><span>待更新</span><strong>{{ validation.stats.update }}</strong></div>
        <div class="import-stat"><span>跳过</span><strong>{{ validation.stats.skip }}</strong></div>
        <div class="import-stat is-warning"><span>警告行</span><strong>{{ validation.stats.warning }}</strong></div>
        <div class="import-stat is-danger"><span>错误行</span><strong>{{ validation.stats.invalid }}</strong></div>
      </div>

      <el-table :data="validation.rows" row-key="rowNo" max-height="520" class="clean-table import-preview-table">
        <el-table-column prop="rowNo" label="行" width="64" align="right" />
        <el-table-column label="结果" width="90">
          <template #default="{ row }">
            <el-tag v-if="!row.valid" type="danger" effect="plain">错误</el-tag>
            <el-tag v-else-if="row.action === 'create'" type="success" effect="plain">新增</el-tag>
            <el-tag v-else-if="row.action === 'update'" type="primary" effect="plain">更新</el-tag>
            <el-tag v-else type="info" effect="plain">跳过</el-tag>
          </template>
        </el-table-column>

        <el-table-column
          v-for="column in schema.previewColumns"
          :key="column.key"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
        >
          <template #default="{ row }">
            {{ formatPreviewValue(row.data?.[column.key]) }}
          </template>
        </el-table-column>

        <el-table-column label="校验说明" min-width="260">
          <template #default="{ row }">
            <div v-if="row.errors?.length" class="validation-messages is-error">
              <span v-for="message in row.errors" :key="message">{{ message }}</span>
            </div>
            <div v-else-if="row.warnings?.length" class="validation-messages is-warning">
              <span v-for="message in row.warnings" :key="message">{{ message }}</span>
            </div>
            <span v-else class="validation-ok">通过</span>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="uploading" class="upload-progress-block">
        <div>
          <strong>正在上传图片</strong>
          <span>{{ uploadProgressText }}</span>
        </div>
        <el-progress :percentage="uploadProgress" :stroke-width="10" />
      </div>

      <div class="import-actions import-actions--commit">
        <div class="commit-note">
          导入会生成独立批次记录。手工编辑过的记录不会被后续回滚覆盖。
        </div>
        <el-button
          type="primary"
          size="large"
          :loading="committing"
          :disabled="validation.stats.invalid > 0 || !validation.importJobsReady"
          @click="commitCurrent"
        >
          上传图片并正式导入
        </el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="panel-card history-panel">
      <div class="import-section-head">
        <div>
          <strong>导入记录</strong>
          <span>可查看每批导入结果。只有尚未被后续修改的记录可以安全回滚。</span>
        </div>
        <el-button :loading="historyLoading" @click="loadJobs">刷新</el-button>
      </div>

      <el-table v-loading="historyLoading" :data="jobs" row-key="_id" class="clean-table">
        <el-table-column prop="_id" label="批次号" min-width="190" />
        <el-table-column prop="importTypeLabel" label="类型" width="90" />
        <el-table-column prop="fileName" label="文件" min-width="180" show-overflow-tooltip />
        <el-table-column label="结果" width="230">
          <template #default="{ row }">
            新增 {{ row.createdCount }} / 更新 {{ row.updatedCount }} / 失败 {{ row.failedCount }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="jobStatus(row.status).type" effect="plain">
              {{ jobStatus(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="showJob(row)">详情</el-button>
            <el-button
              v-if="['completed', 'partial'].includes(row.status)"
              link
              type="danger"
              @click="rollbackJob(row)"
            >
              回滚
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!historyLoading && !jobs.length" :image-size="60" description="还没有导入记录" />
    </el-card>

    <el-dialog v-model="jobDialogVisible" title="导入批次详情" width="680px">
      <el-descriptions v-if="selectedJob" :column="2" border>
        <el-descriptions-item label="批次号" :span="2">{{ selectedJob._id }}</el-descriptions-item>
        <el-descriptions-item label="导入类型">{{ selectedJob.importTypeLabel }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ jobStatus(selectedJob.status).label }}</el-descriptions-item>
        <el-descriptions-item label="新增">{{ selectedJob.createdCount }}</el-descriptions-item>
        <el-descriptions-item label="更新">{{ selectedJob.updatedCount }}</el-descriptions-item>
        <el-descriptions-item label="跳过">{{ selectedJob.skippedCount }}</el-descriptions-item>
        <el-descriptions-item label="失败">{{ selectedJob.failedCount }}</el-descriptions-item>
        <el-descriptions-item label="可追踪变更">{{ selectedJob.changeCount }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatTime(selectedJob.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ selectedJob.note || '—' }}</el-descriptions-item>
      </el-descriptions>

      <div v-if="selectedJob?.errors?.length" class="job-error-list">
        <strong>失败明细</strong>
        <div v-for="item in selectedJob.errors" :key="`${item.rowNo}-${item.code}`">
          第 {{ item.rowNo }} 行 · {{ item.code || '无编码' }}：{{ item.message }}
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import PageHeader from '../components/PageHeader.vue'
import StatusDot from '../components/StatusDot.vue'
import { feedback } from '../utils/feedback'
import { dataImportApi } from '../services/data-import'
import { uploadImportAsset } from '../services/cloudbase'
import { schemaFor, templateOptions, normalizeWorkbookRows } from '../data/import-schemas'

const typeOptions = templateOptions()
const importType = ref('atlas')
const duplicateMode = ref('upsert')
const requireImages = ref(true)
const note = ref('')

const workbookFileName = ref('')
const parsedRows = ref([])
const zipFileName = ref('')
const imageEntries = ref(new Map())
const validation = ref(null)
const validating = ref(false)
const committing = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadProgressText = ref('')

const readiness = ref(null)
const readinessLoading = ref(false)
const readinessError = ref('')
const backfillLoading = ref(false)
const jobs = ref([])
const historyLoading = ref(false)
const jobDialogVisible = ref(false)
const selectedJob = ref(null)

const schema = computed(() => schemaFor(importType.value))

function selectType(type) {
  if (type === importType.value) return
  importType.value = type
  requireImages.value = Boolean(schema.value.imageFileNameField)
  resetCurrent()
}

function clearValidation() {
  validation.value = null
}

function resetCurrent() {
  workbookFileName.value = ''
  parsedRows.value = []
  zipFileName.value = ''
  imageEntries.value = new Map()
  validation.value = null
  uploadProgress.value = 0
  uploadProgressText.value = ''
}

function findHeaderIndex(matrix) {
  const known = Object.keys(schema.value.headerMap)
  let bestIndex = -1
  let bestScore = 0

  matrix.slice(0, 12).forEach((row, index) => {
    const normalized = (row || []).map((cell) => String(cell || '').trim().replace(/\*/g, ''))
    const score = normalized.filter((cell) => known.includes(cell)).length
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  return bestScore >= 2 ? bestIndex : -1
}

async function parseWorkbook(file) {
  const isCsv = file.name.toLowerCase().endsWith('.csv')
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheetName = workbook.SheetNames.includes('导入数据')
    ? '导入数据'
    : workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false
  })
  const headerIndex = findHeaderIndex(matrix)

  if (headerIndex < 0) {
    throw new Error('没有识别到模板表头，请使用本页面下载的对应模板')
  }

  const headers = matrix[headerIndex].map((item) => String(item || '').trim())
  const rawRows = matrix
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell || '').trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))

  const result = normalizeWorkbookRows(importType.value, rawRows)
  if (!result.length) throw new Error('数据文件中没有可导入的记录')
  if (result.length > 100) throw new Error('单次最多导入 100 行，请拆分 Excel 文件')
  return result
}

async function handleWorkbookChange(uploadFile) {
  try {
    const file = uploadFile.raw
    if (!file) return
    parsedRows.value = await parseWorkbook(file)
    workbookFileName.value = file.name
    validation.value = null
    feedback.success(`已读取 ${parsedRows.value.length} 行数据`)
  } catch (error) {
    workbookFileName.value = ''
    parsedRows.value = []
    validation.value = null
    feedback.error(error, '数据文件读取失败')
  }
}

function imageMime(name) {
  const ext = String(name || '').toLowerCase().split('.').pop()
  return {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp'
  }[ext] || 'application/octet-stream'
}

function baseName(name) {
  return String(name || '').replace(/\\/g, '/').split('/').pop().toLowerCase()
}

async function handleZipChange(uploadFile) {
  try {
    const file = uploadFile.raw
    if (!file) return
    if (file.size > 120 * 1024 * 1024) throw new Error('图片 ZIP 不能超过 120MB')

    const zip = await JSZip.loadAsync(file)
    const entries = new Map()

    for (const entry of Object.values(zip.files)) {
      if (entry.dir || entry.name.includes('__MACOSX') || entry.name.endsWith('.DS_Store')) continue
      const key = baseName(entry.name)
      if (!/\.(jpe?g|png|webp)$/i.test(key)) continue
      if (entries.has(key)) throw new Error(`ZIP 内存在重复图片文件名：${key}`)
      entries.set(key, entry)
    }

    if (!entries.size) throw new Error('ZIP 中没有找到 JPG、PNG 或 WEBP 图片')
    if (entries.size > 200) throw new Error('单个 ZIP 最多包含 200 张图片')

    imageEntries.value = entries
    zipFileName.value = file.name
    validation.value = null
    feedback.success(`已识别 ${entries.size} 张图片`)
  } catch (error) {
    imageEntries.value = new Map()
    zipFileName.value = ''
    validation.value = null
    feedback.error(error, '图片 ZIP 读取失败')
  }
}

async function validateCurrent() {
  validating.value = true
  try {
    validation.value = await dataImportApi.validateImport({
      importType: importType.value,
      rows: parsedRows.value,
      duplicateMode: duplicateMode.value,
      availableImageNames: [...imageEntries.value.keys()],
      requireImages: requireImages.value && Boolean(schema.value.imageFileNameField)
    })
    if (validation.value.stats.invalid) feedback.warning(`发现 ${validation.value.stats.invalid} 行错误`)
    else feedback.success('校验通过，可以正式导入')
  } catch (error) {
    feedback.error(error, '导入校验失败')
  } finally {
    validating.value = false
  }
}

function formatPreviewValue(value) {
  if (Array.isArray(value)) return value.join(' | ')
  if (value === true) return '是'
  if (value === false) return '否'
  return value ?? '—'
}

async function uploadMatchedImages(rows) {
  if (!schema.value.imageFileNameField) return new Map()
  const fileNames = [...new Set(
    rows
      .filter((row) => row.valid && row.action !== 'skip')
      .filter((row) => !row.data?.[schema.value.imageFileIdField])
      .map((row) => baseName(row.data?.[schema.value.imageFileNameField]))
      .filter(Boolean)
  )]

  if (!fileNames.length) return new Map()
  const result = new Map()
  uploading.value = true
  uploadProgress.value = 0

  try {
    for (let index = 0; index < fileNames.length; index += 1) {
      const fileName = fileNames[index]
      const entry = imageEntries.value.get(fileName)
      if (!entry) throw new Error(`缺少图片文件：${fileName}`)
      uploadProgressText.value = `${index + 1} / ${fileNames.length} · ${fileName}`
      const rawBlob = await entry.async('blob')
      const blob = new Blob([rawBlob], { type: imageMime(fileName) })
      const fileId = await uploadImportAsset({
        blob,
        fileName,
        folder: schema.value.imageFolder
      })
      result.set(fileName, fileId)
      uploadProgress.value = Math.round(((index + 1) / fileNames.length) * 100)
    }
  } finally {
    uploading.value = false
  }

  return result
}

async function commitCurrent() {
  if (!validation.value || validation.value.stats.invalid) return

  try {
    await ElMessageBox.confirm(
      `确定导入 ${validation.value.stats.valid} 行${schema.value.label}数据吗？导入前请确认已完成数据库备份。`,
      '确认正式导入',
      {
        confirmButtonText: '开始导入',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }

  committing.value = true
  try {
    const imageMap = await uploadMatchedImages(validation.value.rows)
    const commitRows = validation.value.rows.map((row) => {
      const data = { rowNo: row.rowNo, ...(row.data || {}) }
      const fileName = baseName(data[schema.value.imageFileNameField])
      if (fileName && imageMap.has(fileName)) {
        data[schema.value.imageFileIdField] = imageMap.get(fileName)
      }
      return data
    })

    const job = await dataImportApi.commitImport({
      importType: importType.value,
      rows: commitRows,
      duplicateMode: duplicateMode.value,
      requireImages: requireImages.value && Boolean(schema.value.imageFileNameField),
      fileName: workbookFileName.value,
      note: note.value
    })

    feedback.success(`导入完成：新增 ${job.createdCount}，更新 ${job.updatedCount}`)
    await loadJobs()
    resetCurrent()
  } catch (error) {
    feedback.error(error, '正式导入失败')
  } finally {
    committing.value = false
    uploading.value = false
  }
}

async function loadReadiness() {
  readinessLoading.value = true
  readinessError.value = ''
  try {
    readiness.value = await dataImportApi.readiness()
  } catch (error) {
    readiness.value = null
    readinessError.value = error.message || '无法连接 dataImportApi，请确认已经部署云函数'
  } finally {
    readinessLoading.value = false
  }
}

async function backfillCodes() {
  try {
    await ElMessageBox.confirm(
      '系统只会为缺少编码的旧图鉴、商品和横幅生成编码，不会修改已有编码。确定继续吗？',
      '自动补全业务编码',
      {
        confirmButtonText: '开始补全',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }

  backfillLoading.value = true
  try {
    const result = await dataImportApi.backfillBusinessCodes()
    feedback.success(`已补全 ${result.total} 条业务编码`)
    await loadReadiness()
  } catch (error) {
    feedback.error(error, '业务编码补全失败')
  } finally {
    backfillLoading.value = false
  }
}

async function loadJobs() {
  historyLoading.value = true
  try {
    const result = await dataImportApi.listJobs()
    jobs.value = result.items || []
  } catch (error) {
    jobs.value = []
    if (error.code !== 'COLLECTION_NOT_FOUND') feedback.error(error, '导入记录加载失败')
  } finally {
    historyLoading.value = false
  }
}

async function showJob(row) {
  try {
    selectedJob.value = await dataImportApi.getJob(row._id)
    jobDialogVisible.value = true
  } catch (error) {
    feedback.error(error, '导入详情加载失败')
  }
}

async function rollbackJob(row) {
  try {
    await ElMessageBox.confirm(
      `确定回滚批次 ${row._id} 吗？已经被手工修改的记录会跳过，不会强制覆盖。`,
      '回滚导入批次',
      {
        confirmButtonText: '确认回滚',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    const result = await dataImportApi.rollback(row._id)
    feedback.success(`已回滚 ${result.rollbackCount} 条，冲突 ${result.conflictCount} 条`)
    await loadJobs()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') feedback.error(error, '回滚失败')
  }
}

function jobStatus(status) {
  return {
    running: { label: '导入中', type: 'warning' },
    completed: { label: '已完成', type: 'success' },
    partial: { label: '部分成功', type: 'warning' },
    failed: { label: '失败', type: 'danger' },
    rolledBack: { label: '已回滚', type: 'info' },
    rollbackPartial: { label: '部分回滚', type: 'warning' }
  }[status] || { label: status || '未知', type: 'info' }
}

function formatTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

onMounted(async () => {
  await Promise.allSettled([loadReadiness(), loadJobs()])
})
</script>

<style scoped>
.import-alert {
  margin-bottom: 16px;
}

.legacy-code-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid #dfe6d9;
  border-radius: 9px;
  background: #f8faf6;
}

.legacy-code-alert strong,
.legacy-code-alert span {
  display: block;
}

.legacy-code-alert strong {
  color: #42503f;
  font-size: 13px;
}

.legacy-code-alert span {
  margin-top: 5px;
  color: var(--color-muted);
  font-size: 11px;
  line-height: 1.6;
}

.import-workspace,
.validation-panel,
.history-panel {
  margin-bottom: 18px;
}

.import-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 16px;
}

.import-section-head strong,
.import-section-head span {
  display: block;
}

.import-section-head strong {
  color: #334035;
  font-size: 15px;
}

.import-section-head span {
  margin-top: 5px;
  color: var(--color-muted);
  font-size: 11px;
}

.master-template-link {
  color: var(--color-primary-dark);
  font-size: 12px;
  font-weight: 600;
}

.import-type-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.import-type-card {
  display: flex;
  min-height: 112px;
  flex-direction: column;
  align-items: flex-start;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fbfcfa;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.import-type-card:hover,
.import-type-card.is-active {
  border-color: #9eb095;
  background: var(--color-primary-soft);
}

.import-type-card strong {
  color: #354337;
  font-size: 14px;
}

.import-type-card span {
  flex: 1;
  margin-top: 8px;
  color: var(--color-muted);
  font-size: 11px;
  line-height: 1.6;
}

.import-type-card a {
  margin-top: 10px;
  color: var(--color-primary-dark);
  font-size: 11px;
  font-weight: 600;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.file-panel {
  min-height: 156px;
  padding: 18px;
  border: 1px dashed #becabc;
  border-radius: 10px;
  background: #f9fbf8;
}

.file-panel.is-disabled {
  opacity: 0.55;
}

.file-panel__title {
  color: #39443b;
  font-size: 14px;
  font-weight: 650;
}

.file-panel__description {
  min-height: 40px;
  margin: 7px 0 14px;
  color: var(--color-muted);
  font-size: 11px;
  line-height: 1.7;
}

.selected-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding: 9px 10px;
  border-radius: 6px;
  background: #edf3e9;
  color: #4d5e49;
  font-size: 11px;
}

.selected-file span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-file small {
  flex: 0 0 auto;
  margin-left: 12px;
  color: #7e887b;
}

.import-options {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--color-border-light);
}

.import-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

.import-stat-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.import-stat {
  padding: 13px 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #fafbf9;
}

.import-stat span,
.import-stat strong {
  display: block;
}

.import-stat span {
  color: var(--color-muted);
  font-size: 10px;
}

.import-stat strong {
  margin-top: 4px;
  color: #3d473f;
  font-size: 20px;
}

.import-stat.is-success strong { color: #63855d; }
.import-stat.is-primary strong { color: #5d718a; }
.import-stat.is-warning strong { color: #aa7437; }
.import-stat.is-danger strong { color: #bd5b5b; }

.validation-messages {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  line-height: 1.5;
}

.validation-messages.is-error { color: #b54c4c; }
.validation-messages.is-warning { color: #9a6a35; }
.validation-ok { color: #6c8865; font-size: 11px; }

.upload-progress-block {
  margin-top: 16px;
  padding: 14px;
  border-radius: 8px;
  background: #f2f6ef;
}

.upload-progress-block > div {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  color: #586457;
  font-size: 11px;
}

.import-actions--commit {
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
}

.commit-note {
  color: var(--color-muted);
  font-size: 11px;
}

.job-error-list {
  margin-top: 18px;
  padding: 14px;
  border-radius: 8px;
  background: #fff4f2;
  color: #9c4e48;
  font-size: 12px;
  line-height: 1.8;
}

.job-error-list strong {
  display: block;
  margin-bottom: 6px;
}

@media (max-width: 1280px) {
  .import-type-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .import-stat-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
