<template>
  <div>
    <PageHeader
      title="图片定制报价"
      description="查看顾客需求、回复报价，并跟踪用户确认与订单生成状态。"
    >
      <el-button :loading="loading" @click="loadItems">刷新</el-button>
    </PageHeader>

    <div class="summary-grid">
      <button
        v-for="card in summaryCards"
        :key="card.value"
        class="summary-card"
        :class="{ 'summary-card--active': filterStatus === card.value }"
        type="button"
        @click="filterStatus = card.value"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.count }}</strong>
      </button>
    </div>

    <el-card shadow="never" class="panel-card">
      <el-table v-loading="loading" :data="filteredItems" row-key="_id" class="clean-table">
        <el-table-column label="需求信息" min-width="190">
          <template #default="{ row }">
            <div class="stack-cell">
              <strong>{{ row.requestNo }}</strong>
              <span>{{ formatDate(row.createdAtText) }}</span>
              <small>{{ row.imageCount }} 张参考图</small>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="顾客" min-width="190">
          <template #default="{ row }">
            <div class="customer-cell">
              <el-avatar :size="36" :src="row.userAvatarUrl">{{ (row.userNickname || 'C').slice(0, 1) }}</el-avatar>
              <div>
                <strong>{{ row.contactName || row.userNickname }}</strong>
                <span>{{ row.contactPhone || '未留电话' }}</span>
                <span v-if="row.contactWechat">微信：{{ row.contactWechat }}</span>
                <small>{{ row.userId }}</small>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="参考图" min-width="190">
          <template #default="{ row }">
            <div class="thumb-list">
              <el-image
                v-for="src in row.images || []"
                :key="src"
                :src="src"
                fit="cover"
                class="thumb-image"
                :preview-src-list="row.images || []"
                preview-teleported
              />
            </div>
          </template>
        </el-table-column>

        <el-table-column label="需求说明" min-width="240">
          <template #default="{ row }">
            <div class="message-cell">
              {{ row.message || '未填写需求说明' }}
            </div>
          </template>
        </el-table-column>

        <el-table-column label="报价" width="130" align="center">
          <template #default="{ row }">
            <strong v-if="row.quotedPriceText" class="price-text">¥{{ row.quotedPriceText }}</strong>
            <span v-else class="muted-text">待报价</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="135" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="plain" round>{{ row.statusLabel }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="用户操作" width="130" align="center">
          <template #default="{ row }">
            <span :class="decisionClass(row.status)">{{ row.customerDecisionLabel }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220" align="right" fixed="right">
          <template #default="{ row }">
            <el-button link :disabled="!row.contactPhone" @click="copyPhone(row.contactPhone)">复制手机号</el-button>
            <el-button link :disabled="!row.contactWechat" @click="copyWechat(row.contactWechat)">复制微信号</el-button>
            <el-button v-if="row.orderId" link type="success" @click="openOrder(row.orderId)">查看订单</el-button>
            <el-button v-if="row.canReply" link type="primary" @click="openQuote(row)">{{ row.status === 'quoted' ? '修改报价' : '回复报价' }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && !filteredItems.length" :image-size="64" description="当前筛选下暂无定制需求" />
    </el-card>

    <el-dialog v-model="dialogVisible" width="580px" title="回复定制报价" destroy-on-close>
      <el-alert
        v-if="currentRow"
        type="info"
        :closable="false"
        show-icon
        class="quote-alert"
      >
        <template #title>{{ currentRow.requestNo }} · {{ currentRow.contactName || currentRow.userNickname }}</template>
      </el-alert>

      <el-form label-position="top" :model="form">
        <el-form-item label="处理结果">
          <el-radio-group v-model="form.status">
            <el-radio-button value="quoted">给出报价</el-radio-button>
            <el-radio-button value="merchantRejected">暂不接单</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="form.status === 'quoted'" label="报价金额（元）" required>
          <el-input-number
            v-model="form.quotedPriceYuan"
            :min="1"
            :max="999999"
            :precision="2"
            :step="10"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item :label="form.status === 'quoted' ? '报价说明' : '说明'" required>
          <el-input
            v-model="form.merchantReply"
            type="textarea"
            :rows="5"
            maxlength="500"
            show-word-limit
            :placeholder="form.status === 'quoted' ? '说明可制作的风格、主要花材、交付安排及报价包含的内容。' : '说明当前无法承接的原因，方便顾客理解。'"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitQuote">保存并通知顾客</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const items = ref([])
const filterStatus = ref('all')
const dialogVisible = ref(false)
const currentId = ref('')
const currentRow = ref(null)
let refreshTimer = null

const form = reactive({
  status: 'quoted',
  quotedPriceYuan: 0,
  merchantReply: ''
})

const summaryCards = computed(() => [
  { value: 'all', label: '全部需求', count: items.value.length },
  { value: 'pending', label: '待商户确认', count: items.value.filter((row) => row.status === 'pending').length },
  { value: 'quoted', label: '待用户确认', count: items.value.filter((row) => row.status === 'quoted').length },
  { value: 'converted', label: '已生成订单', count: items.value.filter((row) => row.status === 'converted').length },
  { value: 'closed', label: '已结束', count: items.value.filter((row) => ['merchantRejected', 'customerRejected'].includes(row.status)).length }
])

const filteredItems = computed(() => {
  if (filterStatus.value === 'all') return items.value
  if (filterStatus.value === 'closed') {
    return items.value.filter((row) => ['merchantRejected', 'customerRejected'].includes(row.status))
  }
  return items.value.filter((row) => row.status === filterStatus.value)
})

function formatDate(value) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}

function statusType(status) {
  if (['merchantRejected', 'customerRejected'].includes(status)) return 'danger'
  if (status === 'converted') return 'success'
  if (status === 'quoted') return 'primary'
  return 'warning'
}

function decisionClass(status) {
  if (status === 'converted') return 'decision-text decision-text--success'
  if (status === 'customerRejected') return 'decision-text decision-text--danger'
  return 'decision-text'
}

async function loadItems(showLoading = true) {
  if (showLoading) loading.value = true
  try {
    items.value = await adminApi.listQuoteRequests()
  } catch (error) {
    if (showLoading) feedback.error(error, '加载图片定制报价失败')
    else console.warn('自动刷新定制报价失败：', error)
  } finally {
    if (showLoading) loading.value = false
  }
}

async function copyPhone(phone) {
  if (!phone) return
  try {
    await navigator.clipboard.writeText(phone)
    feedback.success('手机号已复制')
  } catch (error) {
    feedback.error(error, '复制手机号失败')
  }
}

async function copyWechat(wechat) {
  if (!wechat) return
  try {
    await navigator.clipboard.writeText(wechat)
    feedback.success('微信号已复制')
  } catch (error) {
    feedback.error(error, '复制微信号失败')
  }
}

function openOrder(id) {
  router.push(`/orders/${id}`)
}

function openQuote(row) {
  currentId.value = row._id
  currentRow.value = row
  form.status = row.status === 'quoted' ? 'quoted' : 'quoted'
  form.quotedPriceYuan = Number(row.quotedPriceYuan || 0)
  form.merchantReply = row.merchantReply || ''
  dialogVisible.value = true
}

async function submitQuote() {
  if (!currentId.value) return
  if (form.status === 'quoted' && Number(form.quotedPriceYuan || 0) <= 0) {
    feedback.warning('请填写有效的报价金额')
    return
  }
  if (!String(form.merchantReply || '').trim()) {
    feedback.warning('请填写回复说明')
    return
  }

  saving.value = true
  try {
    await adminApi.updateQuoteRequest(currentId.value, {
      status: form.status,
      quotedPriceYuan: Number(form.quotedPriceYuan || 0),
      merchantReply: form.merchantReply
    })
    feedback.success(form.status === 'quoted' ? '报价已发送，等待顾客确认' : '处理结果已保存')
    dialogVisible.value = false
    await loadItems()
  } catch (error) {
    feedback.error(error, '保存报价失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadItems()
  refreshTimer = window.setInterval(() => loadItems(false), 30000)
})

onBeforeUnmount(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.summary-card {
  display: flex;
  min-height: 92px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 17px 18px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: #fff;
  color: var(--text-secondary);
  cursor: pointer;
  transition: 0.2s ease;
}

.summary-card strong {
  color: var(--text-primary);
  font-size: 28px;
}

.summary-card:hover,
.summary-card--active {
  border-color: #899875;
  box-shadow: 0 8px 24px rgba(77, 91, 59, 0.08);
}

.summary-card--active {
  background: #f5f7f1;
  color: #5f6d4a;
}

.stack-cell,
.customer-cell div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stack-cell strong,
.customer-cell strong {
  color: var(--text-primary);
}

.stack-cell span,
.stack-cell small,
.customer-cell span,
.customer-cell small {
  color: var(--text-secondary);
  font-size: 13px;
}

.customer-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.customer-cell small {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thumb-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.thumb-image {
  width: 54px;
  height: 54px;
  overflow: hidden;
  border-radius: 12px;
}

.message-cell {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-secondary);
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.price-text {
  color: #5f7047;
  font-size: 16px;
}

.muted-text,
.decision-text {
  color: var(--text-secondary);
  font-size: 13px;
}

.decision-text--success { color: #4e7856; }
.decision-text--danger { color: #aa5e62; }
.quote-alert { margin-bottom: 18px; }

@media (max-width: 1100px) {
  .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
