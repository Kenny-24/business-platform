<template>
  <div class="order-detail-page">
    <PageHeader
      title="订单详情"
      :description="order ? `订单号 ${order.orderNo}` : '查看订单完整信息和处理进度。'"
    >
      <el-button @click="router.push('/orders')">返回订单列表</el-button>
    </PageHeader>

    <div v-if="loading" class="admin-loading-card">
      <el-skeleton :rows="8" animated />
    </div>

    <template v-else-if="order">
      <section class="order-overview">
        <div class="order-overview__identity">
          <div class="order-overview__badges">
            <el-tag :type="tagType(order.statusTone)" effect="plain" size="large" round>
              {{ order.statusLabel }}
            </el-tag>
            <span class="payment-badge">{{ paymentLabel }}</span>
          </div>
          <strong class="order-overview__number">{{ order.orderNo }}</strong>
          <span class="order-overview__time">创建时间 {{ formatDateTime(order.createdAtText) }}</span>
        </div>

        <div class="order-overview__metrics">
          <div class="overview-metric">
            <span>履约方式</span>
            <strong>{{ order.deliveryMethodName }}</strong>
            <small>{{ order.deliveryMethodId === 'pickup' ? '顾客到店领取' : '配送至顾客地址' }}</small>
          </div>
          <div class="overview-metric">
            <span>商品数量</span>
            <strong>{{ order.itemCount || 0 }} 件</strong>
            <small>共 {{ order.items?.length || 0 }} 种商品</small>
          </div>
          <div class="overview-metric overview-metric--amount">
            <span>当前应付</span>
            <strong>¥{{ order.totalAmountText }}</strong>
            <small>{{ order.amountPending ? '配送费尚未确认' : '订单金额已核算' }}</small>
          </div>
        </div>
      </section>

      <section class="order-workspace">
        <main class="order-content-column">
          <el-card shadow="never" class="section-card fulfillment-card">
            <template #header>
              <div class="section-card__header">
                <div>
                  <strong>顾客与履约</strong>
                  <span>收货信息、预约时间和当前确认状态</span>
                </div>
                <el-tag :type="tagType(deliveryScheduleView.tone)" effect="plain" round>
                  {{ deliveryScheduleView.label }}
                </el-tag>
              </div>
            </template>

            <div class="fulfillment-summary">
              <div class="fulfillment-summary__primary">
                <span>{{ order.deliveryMethodId === 'pickup' ? '预约自提时间' : '预期送达时间' }}</span>
                <strong>{{ requestedDeliveryDateText }} · {{ requestedDeliverySlotText }}</strong>
                <small>{{ deliveryScheduleView.description }}</small>
              </div>
              <div v-if="order.confirmedDeliveryDate" class="fulfillment-summary__confirmed">
                <span>最终安排</span>
                <strong>{{ order.confirmedDeliveryDate }} · {{ order.confirmedDeliverySlot }}</strong>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <span>顾客昵称</span>
                <strong>{{ order.customerNickname || 'Chloris 用户' }}</strong>
              </div>
              <div class="info-item">
                <span>收货方式</span>
                <strong>{{ order.deliveryMethodName }}</strong>
              </div>

              <template v-if="order.deliveryMethodId === 'pickup'">
                <div class="info-item info-item--wide">
                  <span>自提门店</span>
                  <strong>{{ order.pickupLocation?.name || '未选择自提门店' }}</strong>
                  <small>{{ order.pickupLocation?.address || '未填写自提地址' }}</small>
                </div>
                <div class="info-item">
                  <span>联系电话</span>
                  <strong>{{ order.pickupLocation?.phone || '未填写' }}</strong>
                </div>
                <div class="info-item">
                  <span>营业时间</span>
                  <strong>{{ order.pickupLocation?.businessHours || '未填写' }}</strong>
                </div>
                <div v-if="order.pickupLocation?.notice" class="info-item info-item--wide">
                  <span>到店提示</span>
                  <strong>{{ order.pickupLocation.notice }}</strong>
                </div>
              </template>

              <template v-else>
                <div class="info-item">
                  <span>收货人</span>
                  <strong>{{ order.address?.receiverName || '未填写' }}</strong>
                </div>
                <div class="info-item">
                  <span>联系电话</span>
                  <strong>{{ order.address?.phone || '未填写' }}</strong>
                </div>
                <div class="info-item info-item--wide">
                  <span>收货地址</span>
                  <strong>{{ order.address?.fullAddress || '未填写收货地址' }}</strong>
                </div>
              </template>

              <div v-if="order.requestedDeliveryNote" class="info-item info-item--wide">
                <span>顾客配送备注</span>
                <strong>{{ order.requestedDeliveryNote }}</strong>
              </div>
            </div>
          </el-card>

          <el-card
            v-if="order.canManageDeliverySchedule || deliveryScheduleView.status !== 'notRequired'"
            shadow="never"
            class="section-card schedule-admin-card"
          >
            <template #header>
              <div class="section-card__header">
                <div>
                  <strong>{{ order.deliveryMethodId === 'pickup' ? '自提时间安排' : '配送时间安排' }}</strong>
                  <span>确认顾客选择，或在沟通后调整最终时间</span>
                </div>
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
              :title="`该订单没有有效的顾客期望${order.deliveryMethodId === 'pickup' ? '自提' : '配送'}时间，请补充后确认。`"
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

            <el-form label-position="top" class="schedule-form schedule-form--grid" :disabled="!order.canManageDeliverySchedule">
              <el-form-item :label="order.deliveryMethodId === 'pickup' ? '自提日期' : '配送日期'" required>
                <el-date-picker
                  v-model="scheduleForm.deliveryDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  format="YYYY-MM-DD"
                  placeholder="选择日期"
                  :disabled-date="disablePastDate"
                  style="width: 100%"
                />
              </el-form-item>
              <el-form-item :label="order.deliveryMethodId === 'pickup' ? '自提时段' : '配送时段'" required>
                <el-select v-model="scheduleForm.deliverySlot" placeholder="选择时段" style="width: 100%">
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
              <el-form-item label="安排说明" class="schedule-form__note">
                <el-input
                  v-model="scheduleForm.note"
                  type="textarea"
                  :rows="3"
                  maxlength="300"
                  show-word-limit
                  :placeholder="order.deliveryMethodId === 'pickup' ? '填写备货完成时间或取货注意事项' : '填写配送说明或调整原因'"
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

          <el-card shadow="never" class="section-card product-section-card">
            <template #header>
              <div class="section-card__header">
                <div>
                  <strong>商品清单</strong>
                  <span>共 {{ order.itemCount || 0 }} 件，{{ order.items?.length || 0 }} 种商品</span>
                </div>
              </div>
            </template>
            <el-table :data="order.items" row-key="productId" class="order-products-table">
              <el-table-column label="商品" min-width="280">
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
                <template #default="{ row }"><strong>¥{{ row.subtotalText }}</strong></template>
              </el-table-column>
            </el-table>
          </el-card>

          <el-card v-if="order.cardMessage || order.buyerMessage || order.merchantNote" shadow="never" class="section-card">
            <template #header>
              <div class="section-card__header">
                <div>
                  <strong>备注信息</strong>
                  <span>顾客留言与商家内部备注</span>
                </div>
              </div>
            </template>
            <div class="order-note-list order-note-list--grid">
              <div v-if="order.cardMessage"><span>贺卡内容</span><p>{{ order.cardMessage }}</p></div>
              <div v-if="order.buyerMessage"><span>买家留言</span><p>{{ order.buyerMessage }}</p></div>
              <div v-if="order.merchantNote"><span>商家备注</span><p>{{ order.merchantNote }}</p></div>
            </div>
          </el-card>

          <el-card shadow="never" class="section-card timeline-card">
            <template #header>
              <div class="section-card__header">
                <div>
                  <strong>订单进度</strong>
                  <span>订单创建后的全部操作记录</span>
                </div>
              </div>
            </template>
            <el-timeline class="order-timeline">
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
        </main>

        <aside class="order-sidebar-column">
          <el-card shadow="never" class="section-card order-action-card order-action-card--primary">
            <template #header>
              <div class="section-card__header">
                <div>
                  <strong>订单处理</strong>
                  <span>当前状态：{{ order.statusLabel }}</span>
                </div>
              </div>
            </template>

            <template v-if="order.status === 'pendingPayment'">
              <p class="order-action-card__hint">顾客订单已进入待付款。确认实际收到款项后，可开始制作。</p>
              <el-button type="primary" :loading="actionLoading" @click="markPaid">确认线下收款并开始制作</el-button>
            </template>

            <template v-else-if="['making', 'delivering'].includes(order.status)">
              <el-form label-position="top" class="logistics-form">
                <el-form-item label="承运公司">
                  <div class="sf-carrier-fixed">
                    <span class="sf-carrier-fixed__mark">SF</span>
                    <div>
                      <strong>顺丰速运</strong>
                      <small>当前系统仅使用顺丰官方物流</small>
                    </div>
                  </div>
                </el-form-item>
                <el-form-item label="顺丰运单号" required>
                  <el-input v-model="logisticsForm.trackingNo" maxlength="32" clearable placeholder="请输入顺丰运单号" />
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

          <el-card v-if="order.trackingNo" shadow="never" class="section-card logistics-summary-card">
            <template #header>
              <div class="section-card__header">
                <div>
                  <strong>顺丰物流</strong>
                  <span>{{ order.logisticsStateLabel || '等待顺丰更新' }}</span>
                </div>
                <span class="sf-mini-mark">SF</span>
              </div>
            </template>
            <div class="logistics-brief">
              <div>
                <span>运单号</span>
                <strong>{{ order.trackingNo }}</strong>
              </div>
              <div>
                <span>物流状态</span>
                <strong>{{ order.logisticsStateLabel || '等待顺丰更新' }}</strong>
              </div>
              <div v-if="order.logisticsUpdatedAt">
                <span>最近同步</span>
                <strong>{{ formatDateTime(order.logisticsUpdatedAt) }}</strong>
              </div>
            </div>
          </el-card>

          <el-card shadow="never" class="section-card amount-card">
            <template #header>
              <div class="section-card__header">
                <div>
                  <strong>费用明细</strong>
                  <span>顾客实际应付金额</span>
                </div>
              </div>
            </template>
            <div class="amount-summary-list amount-summary-list--refined">
              <div><span>商品金额</span><strong>¥{{ order.goodsAmountText }}</strong></div>
              <div><span>配送费用</span><strong>{{ order.deliveryMethodId === 'pickup' ? '无需配送费' : (Number(order.deliveryFeeFen || 0) > 0 ? `¥${order.deliveryFeeText}` : '按订单结算') }}</strong></div>
              <div v-if="order.coupon"><span>优惠券</span><strong>{{ order.coupon.name }}</strong></div>
              <div v-if="Number(order.discountFen || 0) > 0"><span>优惠金额</span><strong class="discount-value">− ¥{{ order.discountText }}</strong></div>
              <div class="is-total"><span>应付金额</span><strong>¥{{ order.totalAmountText }}</strong></div>
            </div>
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
const logisticsForm = reactive({ companyCode: 'shunfeng', companyName: '顺丰速运', trackingNo: '' })
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
  logisticsForm.companyCode = 'shunfeng'
  logisticsForm.companyName = '顺丰速运'
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

function startCurrentDelivery() {
  const trackingNo = String(logisticsForm.trackingNo || '').replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z0-9-]{8,32}$/.test(trackingNo)) {
    feedback.warning('请输入正确的顺丰运单号')
    return
  }
  const wasMaking = order.value.status === 'making'
  return runAction(
    () => adminApi.startDelivery(order.value._id, {
      logisticsCompanyCode: 'shunfeng',
      logisticsCompanyName: '顺丰速运',
      trackingNo,
      note: actionForm.note
    }),
    wasMaking ? '订单已交由顺丰配送' : '顺丰运单信息已更新'
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
.order-detail-page {
  max-width: 1480px;
  margin: 0 auto;
}

.order-overview {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(560px, 1.45fr);
  gap: 24px;
  align-items: stretch;
  margin-bottom: 18px;
  padding: 22px 24px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: #fff;
}

.order-overview__identity {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
}

.order-overview__badges {
  display: flex;
  align-items: center;
  gap: 10px;
}

.payment-badge {
  padding: 4px 9px;
  border-radius: 999px;
  background: #f4f5f2;
  color: var(--color-muted);
  font-size: 11px;
}

.order-overview__number {
  margin-top: 14px;
  color: #263027;
  font-size: 22px;
  letter-spacing: .02em;
  overflow-wrap: anywhere;
}

.order-overview__time {
  margin-top: 7px;
  color: var(--color-muted);
  font-size: 11px;
}

.order-overview__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  background: #fafbf9;
}

.overview-metric {
  min-width: 0;
  padding: 16px 18px;
}

.overview-metric + .overview-metric {
  border-left: 1px solid var(--color-border-light);
}

.overview-metric span,
.overview-metric strong,
.overview-metric small {
  display: block;
}

.overview-metric span {
  color: var(--color-muted);
  font-size: 10px;
}

.overview-metric strong {
  margin-top: 8px;
  color: #354037;
  font-size: 17px;
}

.overview-metric small {
  margin-top: 5px;
  color: #9aa09a;
  font-size: 10px;
  line-height: 1.45;
}

.overview-metric--amount strong {
  color: var(--color-primary-dark);
  font-size: 24px;
}

.order-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 18px;
  align-items: start;
}

.order-content-column,
.order-sidebar-column {
  min-width: 0;
}

.section-card {
  border-radius: 12px;
}

.section-card + .section-card {
  margin-top: 18px;
}

.section-card :deep(.el-card__header) {
  padding: 17px 19px;
  border-bottom-color: var(--color-border-light);
}

.section-card :deep(.el-card__body) {
  padding: 19px;
}

.section-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-card__header > div {
  min-width: 0;
}

.section-card__header > div > strong,
.section-card__header > div > span {
  display: block;
}

.section-card__header > div > strong {
  color: #263027;
  font-size: 15px;
}

.section-card__header > div > span {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: 10px;
  font-weight: 400;
}

.fulfillment-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(210px, .55fr);
  gap: 12px;
  margin-bottom: 18px;
}

.fulfillment-summary__primary,
.fulfillment-summary__confirmed {
  padding: 16px 17px;
  border: 1px solid #e5e9e1;
  border-radius: 10px;
  background: #f8faf7;
}

.fulfillment-summary span,
.fulfillment-summary strong,
.fulfillment-summary small {
  display: block;
}

.fulfillment-summary span {
  color: var(--color-muted);
  font-size: 10px;
}

.fulfillment-summary strong {
  margin-top: 7px;
  color: #334038;
  font-size: 17px;
}

.fulfillment-summary small {
  margin-top: 6px;
  color: #7d857e;
  font-size: 10px;
  line-height: 1.55;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid var(--color-border-light);
  border-left: 1px solid var(--color-border-light);
}

.info-item {
  min-width: 0;
  padding: 14px 16px;
  border-right: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
  background: #fff;
}

.info-item--wide {
  grid-column: 1 / -1;
}

.info-item span,
.info-item strong,
.info-item small {
  display: block;
}

.info-item span {
  color: var(--color-muted);
  font-size: 10px;
}

.info-item strong {
  margin-top: 6px;
  color: #354037;
  font-size: 12px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.info-item small {
  margin-top: 4px;
  color: #7e857e;
  font-size: 10px;
  line-height: 1.55;
}

.schedule-form {
  margin-top: 16px;
}

.schedule-form--grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 14px;
}

.schedule-form__note {
  grid-column: 1 / -1;
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

.order-products-table :deep(.el-table__header th) {
  background: #fafbf9;
  color: #6e766f;
  font-size: 11px;
  font-weight: 500;
}

.order-products-table :deep(.el-table__cell) {
  padding-top: 13px;
  padding-bottom: 13px;
}

.order-note-list--grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.order-note-list--grid > div {
  min-width: 0;
  margin: 0 !important;
  padding: 14px 15px !important;
  border: 1px solid var(--color-border-light) !important;
  border-radius: 9px;
  background: #fafbf9;
}

.order-note-list--grid > div:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}

.order-note-list--grid p {
  min-height: 22px;
}

.order-timeline {
  padding-top: 4px;
}

.order-timeline :deep(.el-timeline-item__timestamp) {
  color: #98a098;
  font-size: 10px;
}

.order-timeline :deep(.el-timeline-item__content strong) {
  color: #354037;
  font-size: 12px;
}

.order-timeline :deep(.el-timeline-item__content p) {
  margin: 5px 0 0;
  color: var(--color-muted);
  font-size: 10px;
  line-height: 1.6;
}

.order-sidebar-column {
  position: relative;
}

.order-action-card--primary {
  border-color: #dbe2d7;
}

.order-action-card--primary :deep(.el-card__header) {
  background: #f8faf7;
}

.order-action-card .el-button {
  width: 100%;
  margin: 9px 0 0;
}

.order-action-card__hint {
  margin: 0 0 13px;
  color: var(--color-muted);
  font-size: 11px;
  line-height: 1.7;
}

.logistics-form {
  margin-bottom: 12px;
}

.sf-carrier-fixed {
  display: flex;
  width: 100%;
  min-height: 58px;
  box-sizing: border-box;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 9px;
  background: #f8f9f7;
}

.sf-carrier-fixed__mark,
.sf-mini-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #111;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .04em;
}

.sf-carrier-fixed__mark {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
}

.sf-mini-mark {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
}

.sf-carrier-fixed strong,
.sf-carrier-fixed small {
  display: block;
}

.sf-carrier-fixed small {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 10px;
}

.logistics-brief > div {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 11px 0;
}

.logistics-brief > div + div {
  border-top: 1px solid var(--color-border-light);
}

.logistics-brief span {
  color: var(--color-muted);
  font-size: 10px;
}

.logistics-brief strong {
  color: #354037;
  font-size: 11px;
  line-height: 1.55;
  text-align: right;
  overflow-wrap: anywhere;
}

.amount-summary-list--refined > div {
  min-height: 38px;
}

.amount-summary-list--refined .discount-value {
  color: #a66e67;
}

.amount-summary-list--refined .is-total {
  margin-top: 10px;
  padding-top: 15px;
}

.amount-summary-list--refined .is-total strong {
  font-size: 24px;
}

@media (max-width: 1180px) {
  .order-overview {
    grid-template-columns: minmax(0, 1fr);
  }

  .order-workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .order-sidebar-column {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .order-sidebar-column .section-card + .section-card {
    margin-top: 0;
  }

  .order-action-card--primary {
    grid-row: span 2;
  }
}

@media (max-width: 820px) {
  .order-overview {
    padding: 18px;
  }

  .order-overview__metrics {
    grid-template-columns: minmax(0, 1fr);
  }

  .overview-metric + .overview-metric {
    border-top: 1px solid var(--color-border-light);
    border-left: 0;
  }

  .fulfillment-summary,
  .info-grid,
  .schedule-form--grid,
  .order-note-list--grid,
  .order-sidebar-column {
    grid-template-columns: minmax(0, 1fr);
  }

  .info-item--wide,
  .schedule-form__note,
  .order-note-list--grid > div:last-child:nth-child(odd) {
    grid-column: auto;
  }

  .schedule-action-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .section-card__header {
    align-items: flex-start;
  }

  .order-action-card--primary {
    grid-row: auto;
  }
}
</style>
