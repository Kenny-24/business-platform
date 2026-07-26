<template>
  <div>
    <PageHeader
      title="订单详情"
      :description="order ? `订单号 ${order.orderNo}` : '查看订单完整信息和处理进度。'"
    >
      <el-button @click="router.push('/orders')">返回列表</el-button>
    </PageHeader>

    <div v-if="loading" class="admin-loading-card">
      <el-skeleton :rows="8" animated />
    </div>

    <template v-else-if="order">
      <section class="order-detail-header">
        <div>
          <el-tag :type="tagType(order.statusTone)" effect="plain" size="large" round>
            {{ order.statusLabel }}
          </el-tag>
          <span class="order-detail-header__payment">{{ paymentLabel }}</span>
        </div>

        <div class="order-detail-header__amount">
          <span>当前应付</span>
          <strong>¥{{ order.totalAmountText }}</strong>
          <small v-if="order.amountPending">配送费尚未确认</small>
        </div>
      </section>

      <section class="admin-detail-grid">
        <div class="admin-detail-main">
          <el-card shadow="never" class="panel-card">
            <template #header><strong>顾客与履约信息</strong></template>

            <el-descriptions :column="2" border>
              <el-descriptions-item label="顾客昵称">{{ order.customerNickname || 'Chloris 用户' }}</el-descriptions-item>
              <el-descriptions-item label="收货方式">{{ order.deliveryMethodName }}</el-descriptions-item>

              <el-descriptions-item :label="order.deliveryMethodId === 'pickup' ? '顾客预约自提日期' : '顾客预期送达日期'">
                {{ requestedDeliveryDateText }}
              </el-descriptions-item>
              <el-descriptions-item :label="order.deliveryMethodId === 'pickup' ? '顾客预约自提时段' : '顾客预期送达时段'">
                {{ requestedDeliverySlotText }}
              </el-descriptions-item>
              <el-descriptions-item label="配送确认状态" :span="2">
                <div class="delivery-status-cell">
                  <el-tag :type="tagType(deliveryScheduleView.tone)" effect="plain" round>
                    {{ deliveryScheduleView.label }}
                  </el-tag>
                  <span>{{ deliveryScheduleView.description }}</span>
                </div>
              </el-descriptions-item>
              <el-descriptions-item v-if="order.confirmedDeliveryDate" label="最终配送时间" :span="2">
                {{ order.confirmedDeliveryDate }} · {{ order.confirmedDeliverySlot }}
              </el-descriptions-item>
              <el-descriptions-item v-if="order.proposedDeliveryDate && order.deliveryScheduleStatus !== 'confirmed'" label="商家建议时间" :span="2">
                {{ order.proposedDeliveryDate }} · {{ order.proposedDeliverySlot }}
              </el-descriptions-item>
              <el-descriptions-item v-if="order.requestedDeliveryNote" label="顾客配送备注" :span="2">
                {{ order.requestedDeliveryNote }}
              </el-descriptions-item>

              <template v-if="order.deliveryMethodId === 'pickup'">
                <el-descriptions-item label="自提门店" :span="2">
                  {{ order.pickupLocation?.name || '未选择自提门店' }}
                </el-descriptions-item>
                <el-descriptions-item label="自提地址" :span="2">
                  {{ order.pickupLocation?.address || '未填写自提地址' }}
                </el-descriptions-item>
                <el-descriptions-item label="门店联系方式" :span="2">
                  {{ order.pickupLocation?.phone || '未填写联系电话' }}
                  <template v-if="order.pickupLocation?.businessHours"> · {{ order.pickupLocation.businessHours }}</template>
                </el-descriptions-item>
                <el-descriptions-item v-if="order.pickupLocation?.notice" label="到店提示" :span="2">
                  {{ order.pickupLocation.notice }}
                </el-descriptions-item>
              </template>
              <template v-else>
                <el-descriptions-item label="收货人" :span="2">
                  <template v-if="order.address">
                    {{ order.address.receiverName }} · {{ order.address.phone }}
                  </template>
                  <template v-else>未填写收货人</template>
                </el-descriptions-item>
                <el-descriptions-item label="收货地址" :span="2">
                  {{ order.address?.fullAddress || '未填写收货地址' }}
                </el-descriptions-item>
              </template>
            </el-descriptions>
          </el-card>

          <el-card shadow="never" class="panel-card">
            <template #header><strong>商品清单</strong></template>
            <el-table :data="order.items" row-key="productId">
              <el-table-column label="商品" min-width="260">
                <template #default="{ row }">
                  <div class="product-cell">
                    <el-image class="table-thumb" :src="row.imageUrl" fit="cover">
                      <template #error><div class="table-thumb__empty">无图</div></template>
                    </el-image>
                    <div class="product-cell__text">
                      <strong>{{ row.name }}</strong>
                      <span>{{ row.subtitle || row.unit }}</span>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="单价" width="110" align="right">
                <template #default="{ row }">¥{{ row.unitPriceText }}</template>
              </el-table-column>
              <el-table-column prop="quantity" label="数量" width="90" align="right" />
              <el-table-column label="小计" width="120" align="right">
                <template #default="{ row }">¥{{ row.subtotalText }}</template>
              </el-table-column>
            </el-table>
          </el-card>

          <el-card v-if="order.cardMessage || order.buyerMessage || order.merchantNote" shadow="never" class="panel-card">
            <template #header><strong>备注信息</strong></template>
            <div class="order-note-list">
              <div v-if="order.cardMessage"><span>贺卡内容</span><p>{{ order.cardMessage }}</p></div>
              <div v-if="order.buyerMessage"><span>买家留言</span><p>{{ order.buyerMessage }}</p></div>
              <div v-if="order.merchantNote"><span>商家备注</span><p>{{ order.merchantNote }}</p></div>
            </div>
          </el-card>
        </div>

        <aside class="admin-detail-side">
          <el-card v-if="order.canManageDeliverySchedule || deliveryScheduleView.status !== 'notRequired'" shadow="never" class="panel-card schedule-admin-card">
            <template #header>
              <div class="schedule-admin-card__header">
                <strong>{{ order.deliveryMethodId === 'pickup' ? '自提时间安排' : '配送时间安排' }}</strong>
                <el-tag :type="tagType(deliveryScheduleView.tone)" effect="plain" round>
                  {{ deliveryScheduleView.label }}
                </el-tag>
              </div>
            </template>

            <el-alert
              v-if="deliveryScheduleView.status === 'missingSchedule'"
              type="warning"
              :closable="false"
              show-icon
              :title="`该订单没有有效的顾客期望${order.deliveryMethodId === 'pickup' ? '自提' : '配送'}时间，请在下方补充日期和时段后直接确认。`"
            />
            <el-alert
              v-else-if="deliveryScheduleView.status === 'customerConfirmationRequired'"
              type="warning"
              :closable="false"
              show-icon
              :title="order.deliveryMethodId === 'pickup' ? '已调整自提时间，正在等待顾客确认' : '已调整配送时间，正在等待顾客确认'"
            />
            <el-alert
              v-else-if="deliveryScheduleView.status === 'adjustmentRejected'"
              type="error"
              :closable="false"
              show-icon
              :title="order.deliveryMethodId === 'pickup' ? '顾客未接受上次自提时间调整，请重新沟通' : '顾客未接受上次配送时间调整，请重新沟通'"
            />

            <el-form label-position="top" class="schedule-form" :disabled="!order.canManageDeliverySchedule">
              <el-form-item :label="order.deliveryMethodId === 'pickup' ? '自提日期' : '配送日期'" required>
                <el-date-picker
                  v-model="scheduleForm.deliveryDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  format="YYYY-MM-DD"
                  placeholder="选择配送日期"
                  :disabled-date="disablePastDate"
                  style="width: 100%"
                />
              </el-form-item>
              <el-form-item :label="order.deliveryMethodId === 'pickup' ? '自提时段' : '配送时段'" required>
                <el-select v-model="scheduleForm.deliverySlot" placeholder="选择配送时段" style="width: 100%">
                  <el-option v-for="slot in deliverySlots" :key="slot" :label="slot" :value="slot" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="order.deliveryMethodId !== 'pickup'" label="配送费用（元）">
                <el-input-number
                  v-model="scheduleForm.deliveryFeeYuan"
                  :min="0"
                  :precision="2"
                  :step="1"
                  controls-position="right"
                  style="width: 100%"
                />
              </el-form-item>
              <el-form-item label="配送说明">
                <el-input
                  v-model="scheduleForm.note"
                  type="textarea"
                  :rows="3"
                  maxlength="300"
                  show-word-limit
                  :placeholder="order.deliveryMethodId === 'pickup' ? '例如：门店备货完成时间或取货注意事项' : '例如：可按顾客时间配送，或说明调整原因'"
                />
              </el-form-item>
            </el-form>

            <div class="schedule-action-grid">
              <el-button :disabled="!order.canManageDeliverySchedule || order.status === 'delivering'" :loading="scheduleLoading" @click="saveDeliverySchedule('propose')">
                {{ order.deliveryMethodId === 'pickup' ? '调整自提时间' : '调整配送时间' }}
              </el-button>
              <el-button type="primary" :disabled="!order.canManageDeliverySchedule" :loading="scheduleLoading" @click="saveDeliverySchedule('confirmRequested')">
                {{ order.deliveryMethodId === 'pickup' ? '确认自提时间' : '确认配送时间' }}
              </el-button>
            </div>
          </el-card>

          <el-card shadow="never" class="panel-card order-action-card">
            <template #header><strong>订单处理</strong></template>
            <template v-if="order.status === 'pendingPayment'">
              <p class="order-action-card__hint">
                顾客订单已直接进入待付款。确认实际收到款项后，可开始制作。
              </p>
              <el-button type="primary" :loading="actionLoading" @click="markPaid">
                确认线下收款并开始制作
              </el-button>
            </template>

            <template v-else-if="['making', 'delivering'].includes(order.status)">
              <el-form label-position="top" class="logistics-form">
                <el-form-item label="快递公司" required>
                  <el-select v-model="logisticsForm.companyCode" placeholder="选择快递公司" style="width: 100%" @change="syncLogisticsCompanyName">
                    <el-option v-for="carrier in logisticsCompanies" :key="carrier.code" :label="carrier.name" :value="carrier.code" />
                  </el-select>
                </el-form-item>
                <el-form-item label="快递单号" required>
                  <el-input v-model="logisticsForm.trackingNo" maxlength="32" clearable placeholder="请输入快递单号" />
                </el-form-item>
                <el-form-item label="配送备注">
                  <el-input v-model="actionForm.note" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="可填写预计送达时间、配送说明等" />
                </el-form-item>
              </el-form>
              <el-button type="primary" :loading="actionLoading" @click="startCurrentDelivery">
                {{ order.status === 'making' ? '填写物流并开始配送' : '更新物流信息' }}
              </el-button>
              <el-button v-if="order.status === 'delivering'" :loading="actionLoading" @click="completeCurrentOrder">完成订单</el-button>
            </template>

            <template v-else>
              <el-empty :image-size="52" description="当前状态无需处理" />
            </template>

            <el-divider />
            <el-button
              v-if="['pendingConfirm', 'pendingPayment', 'making'].includes(order.status)"
              type="danger"
              plain
              :loading="actionLoading"
              @click="cancelCurrentOrder"
            >取消订单</el-button>
          </el-card>

          <el-card shadow="never" class="panel-card">
            <template #header><strong>费用明细</strong></template>
            <div class="amount-summary-list">
              <div><span>商品金额</span><strong>¥{{ order.goodsAmountText }}</strong></div>
              <div><span>配送费用</span><strong>{{ Number(order.deliveryFeeFen || 0) > 0 ? `¥${order.deliveryFeeText}` : '免费' }}</strong></div>
              <div><span>优惠金额</span><strong>− ¥{{ order.discountText }}</strong></div>
              <div class="is-total"><span>应付金额</span><strong>¥{{ order.totalAmountText }}</strong></div>
            </div>
          </el-card>

          <el-card shadow="never" class="panel-card">
            <template #header><strong>订单进度</strong></template>
            <el-timeline>
              <el-timeline-item
                v-for="log in order.logs"
                :key="log._id"
                :timestamp="formatDateTime(log.createdAtText)"
                placement="top"
                color="#6f8765"
              >
                <strong>{{ log.title }}</strong>
                <p v-if="log.note">{{ log.note }}</p>
              </el-timeline-item>
            </el-timeline>
          </el-card>
        </aside>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import PageHeader from '../components/PageHeader.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const actionLoading = ref(false)
const scheduleLoading = ref(false)
const order = ref(null)
const deliverySlots = ['09:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-20:00']

const actionForm = reactive({ deliveryFeeYuan: 0, note: '' })
const logisticsCompanies = [
  { code: 'shunfeng', name: '顺丰速运' },
  { code: 'zhongtong', name: '中通快递' },
  { code: 'yuantong', name: '圆通速递' },
  { code: 'shentong', name: '申通快递' },
  { code: 'yunda', name: '韵达快递' },
  { code: 'jtexpress', name: '极兔速递' },
  { code: 'jd', name: '京东物流' },
  { code: 'ems', name: 'EMS' },
  { code: 'debangwuliu', name: '德邦物流' }
]
const logisticsForm = reactive({ companyCode: '', companyName: '', trackingNo: '' })
const scheduleForm = reactive({
  deliveryDate: '',
  deliverySlot: '',
  deliveryFeeYuan: 0,
  note: ''
})

const paymentLabel = computed(() => {
  if (!order.value) return ''
  if (order.value.paymentStatus === 'offlinePaid') return '已确认线下收款'
  if (order.value.paymentStatus === 'paid') return '已付款'
  return '未付款'
})

const canMarkPaid = computed(() => Boolean(order.value && order.value.status === 'pendingPayment'))

const deliveryScheduleView = computed(() => {
  const current = order.value || {}
  const status = String(current.deliveryScheduleStatus || '').trim()
  const fulfillmentName = current.deliveryMethodId === 'pickup' ? '自提' : '配送'
  const map = {
    notRequired: {
      label: '无需二次确认',
      tone: 'info',
      description: `该订单不需要额外确认${fulfillmentName}时间。`
    },
    missingSchedule: {
      label: `待补充${fulfillmentName}时间`,
      tone: 'warning',
      description: `该订单尚未填写有效的${fulfillmentName}日期和时段，请由商家补充并确认。`
    },
    pendingMerchantConfirm: {
      label: '时间已选定',
      tone: 'success',
      description: `顾客已选择${fulfillmentName}时间，可直接付款。`
    },
    customerConfirmationRequired: {
      label: '时间已选定',
      tone: 'success',
      description: `顾客已选择${fulfillmentName}时间，可直接付款。`
    },
    confirmed: {
      label: '时间已确认',
      tone: 'success',
      description: `最终${fulfillmentName}日期和时段已经确认。`
    },
    adjustmentRejected: {
      label: '时间已选定',
      tone: 'success',
      description: `顾客已选择${fulfillmentName}时间，可直接付款。`
    }
  }

  const requestedReady = validDate(current.requestedDeliveryDate)
    && deliverySlots.includes(String(current.requestedDeliverySlot || ''))
  const confirmedReady = validDate(current.confirmedDeliveryDate)
    && deliverySlots.includes(String(current.confirmedDeliverySlot || ''))
  const proposedReady = validDate(current.proposedDeliveryDate)
    && deliverySlots.includes(String(current.proposedDeliverySlot || ''))

  let normalized = status
  if (confirmedReady) normalized = 'confirmed'
  else if (proposedReady && status === 'adjustmentRejected') normalized = 'adjustmentRejected'
  else if (proposedReady) normalized = 'customerConfirmationRequired'
  else if (!requestedReady) normalized = 'missingSchedule'
  else if (normalized === 'notRequired') normalized = 'pendingMerchantConfirm'
  else if (!map[normalized] || normalized === 'confirmed') normalized = 'pendingMerchantConfirm'

  const fallback = map[normalized] || map.pendingMerchantConfirm
  const apiMetaMatches = normalized === status && Boolean(map[normalized])
  return {
    status: normalized,
    label: apiMetaMatches && current.deliveryScheduleStatusLabel
      ? current.deliveryScheduleStatusLabel
      : fallback.label,
    tone: apiMetaMatches && current.deliveryScheduleStatusTone
      ? current.deliveryScheduleStatusTone
      : fallback.tone,
    description: apiMetaMatches && current.deliveryScheduleStatusDescription
      ? current.deliveryScheduleStatusDescription
      : fallback.description
  }
})

const requestedDeliveryDateText = computed(() => (
  validDate(order.value?.requestedDeliveryDate) ? order.value.requestedDeliveryDate : '未填写'
))

const requestedDeliverySlotText = computed(() => (
  deliverySlots.includes(String(order.value?.requestedDeliverySlot || ''))
    ? order.value.requestedDeliverySlot
    : '未填写'
))

function tagType(tone) {
  return ({ success: 'success', warning: 'warning', danger: 'danger', info: 'info', primary: 'primary' })[tone] || 'info'
}

function formatDateTime(value) {
  if (!value) return '时间未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date)
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

function disablePastDate(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

function hydrateForms() {
  if (!order.value) return
  actionForm.deliveryFeeYuan = Number(order.value.deliveryFeeFen || 0) / 100
  actionForm.note = order.value.merchantNote || ''
  logisticsForm.companyCode = order.value.logisticsCompanyCode || ''
  logisticsForm.companyName = order.value.logisticsCompanyName || ''
  logisticsForm.trackingNo = order.value.trackingNo || ''

  const candidateDate = [
    order.value.confirmedDeliveryDate,
    order.value.proposedDeliveryDate,
    order.value.requestedDeliveryDate,
    order.value.deliveryDate
  ].find(validDate)
  const candidateSlot = [
    order.value.confirmedDeliverySlot,
    order.value.proposedDeliverySlot,
    order.value.requestedDeliverySlot,
    order.value.deliverySlot
  ].find((value) => deliverySlots.includes(value))

  scheduleForm.deliveryDate = candidateDate || ''
  scheduleForm.deliverySlot = candidateSlot || deliverySlots[0]
  scheduleForm.deliveryFeeYuan = Number(order.value.deliveryFeeFen || 0) / 100
  scheduleForm.note = order.value.deliveryAdjustmentNote || ''
}

async function loadOrder() {
  loading.value = true
  try {
    order.value = await adminApi.getOrder(route.params.id)
    hydrateForms()
  } catch (error) {
    feedback.error(error, '订单详情加载失败')
  } finally {
    loading.value = false
  }
}

async function runAction(action, successText) {
  actionLoading.value = true
  try {
    await action()
    feedback.success(successText)
    actionForm.note = ''
    await loadOrder()
  } catch (error) {
    feedback.error(error, '订单操作失败')
  } finally {
    actionLoading.value = false
  }
}

async function saveDeliverySchedule(mode) {
  if (!scheduleForm.deliveryDate) {
    feedback.warning('请选择配送日期')
    return
  }
  if (!scheduleForm.deliverySlot) {
    feedback.warning('请选择配送时段')
    return
  }

  scheduleLoading.value = true
  try {
    await adminApi.updateDeliverySchedule(order.value._id, {
      mode,
      deliveryDate: scheduleForm.deliveryDate,
      deliverySlot: scheduleForm.deliverySlot,
      deliveryFeeFen: Math.round(Number(scheduleForm.deliveryFeeYuan || 0) * 100),
      note: scheduleForm.note
    })
    feedback.success(mode === 'confirmRequested' ? '配送时间已确认' : '调整时间已发送给顾客')
    await loadOrder()
  } catch (error) {
    feedback.error(error, '配送时间保存失败')
  } finally {
    scheduleLoading.value = false
  }
}

function confirmCurrentOrder() {
  return runAction(
    () => adminApi.confirmOrder(order.value._id, {
      deliveryFeeFen: Math.round(Number(actionForm.deliveryFeeYuan || 0) * 100),
      merchantNote: actionForm.note
    }),
    '订单已确认'
  )
}

async function rejectCurrentOrder() {
  try {
    const { value } = await ElMessageBox.prompt('请输入无法接单的原因，顾客会在订单详情中看到。', '无法接单', {
      confirmButtonText: '确认取消订单', cancelButtonText: '返回', inputPlaceholder: '例如：指定花材暂时缺货',
      inputValidator: (text) => Boolean(String(text || '').trim()) || '请输入原因'
    })
    await runAction(() => adminApi.rejectOrder(order.value._id, value), '订单已取消')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') feedback.error(error, '取消订单失败')
  }
}

function markPaid() {
  return runAction(() => adminApi.markOrderPaid(order.value._id, actionForm.note), '已确认收款，订单进入制作中')
}

function syncLogisticsCompanyName(code) {
  logisticsForm.companyName = logisticsCompanies.find((item) => item.code === code)?.name || ''
}

function startCurrentDelivery() {
  if (!logisticsForm.companyCode) {
    feedback.warning('请选择快递公司')
    return
  }
  const trackingNo = String(logisticsForm.trackingNo || '').replace(/\s+/g, '')
  if (!/^[A-Za-z0-9-]{6,32}$/.test(trackingNo)) {
    feedback.warning('请输入正确的快递单号')
    return
  }
  syncLogisticsCompanyName(logisticsForm.companyCode)
  const wasMaking = order.value.status === 'making'
  return runAction(
    () => adminApi.startDelivery(order.value._id, {
      logisticsCompanyCode: logisticsForm.companyCode,
      logisticsCompanyName: logisticsForm.companyName,
      trackingNo,
      note: actionForm.note
    }),
    wasMaking ? '订单已开始配送，物流信息已保存' : '物流信息已更新'
  )
}

function completeCurrentOrder() {
  return runAction(() => adminApi.completeOrder(order.value._id, actionForm.note), '订单已完成')
}

async function cancelCurrentOrder() {
  try {
    const { value } = await ElMessageBox.prompt('请输入取消原因。', '取消订单', {
      confirmButtonText: '确认取消', cancelButtonText: '返回', inputPlaceholder: '取消原因',
      inputValidator: (text) => Boolean(String(text || '').trim()) || '请输入原因'
    })
    await runAction(() => adminApi.cancelAdminOrder(order.value._id, value), '订单已取消')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') feedback.error(error, '取消订单失败')
  }
}

onMounted(loadOrder)
</script>

<style scoped>
.schedule-admin-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.delivery-status-cell {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 32px;
}

.delivery-status-cell > span {
  color: var(--el-text-color-secondary);
  line-height: 1.55;
}

.schedule-form {
  margin-top: 16px;
}

.logistics-form {
  margin-bottom: 12px;
}

.schedule-action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.schedule-action-grid :deep(.el-button) {
  width: 100%;
  margin-left: 0;
}

@media (max-width: 720px) {
  .schedule-action-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
