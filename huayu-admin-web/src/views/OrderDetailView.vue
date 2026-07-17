<template>
  <div>
    <PageHeader
      title="订单详情"
      :description="order ? `订单号 ${order.orderNo}` : '查看订单完整信息和处理进度。'"
    >
      <el-button @click="router.push('/orders')">
        返回列表
      </el-button>
    </PageHeader>

    <div
      v-if="loading"
      class="admin-loading-card"
    >
      <el-skeleton :rows="8" animated />
    </div>

    <template v-else-if="order">
      <section class="order-detail-header">
        <div>
          <el-tag
            :type="tagType(order.statusTone)"
            effect="plain"
            size="large"
            round
          >
            {{ order.statusLabel }}
          </el-tag>
          <span class="order-detail-header__payment">
            {{ paymentLabel }}
          </span>
        </div>

        <div class="order-detail-header__amount">
          <span>当前应付</span>
          <strong>¥{{ order.totalAmountText }}</strong>
          <small v-if="order.amountPending">
            配送费尚未确认
          </small>
        </div>
      </section>

      <section class="admin-detail-grid">
        <div class="admin-detail-main">
          <el-card
            shadow="never"
            class="panel-card"
          >
            <template #header>
              <strong>顾客与配送信息</strong>
            </template>

            <el-descriptions
              :column="2"
              border
            >
              <el-descriptions-item label="顾客昵称">
                {{ order.customerNickname }}
              </el-descriptions-item>
              <el-descriptions-item label="收货方式">
                {{ order.deliveryMethodName }}
              </el-descriptions-item>
              <el-descriptions-item label="配送日期">
                {{ order.deliveryDate || '未选择' }}
              </el-descriptions-item>
              <el-descriptions-item label="配送时段">
                {{ order.deliverySlot || '未选择' }}
              </el-descriptions-item>
              <el-descriptions-item
                label="收货人"
                :span="2"
              >
                <template v-if="order.address">
                  {{ order.address.receiverName }}
                  · {{ order.address.phone }}
                </template>
                <template v-else>
                  到店自取
                </template>
              </el-descriptions-item>
              <el-descriptions-item
                label="收货地址"
                :span="2"
              >
                {{ order.address?.fullAddress || '到店自取，无需配送地址' }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>

          <el-card
            shadow="never"
            class="panel-card"
          >
            <template #header>
              <strong>商品清单</strong>
            </template>

            <el-table
              :data="order.items"
              row-key="productId"
            >
              <el-table-column
                label="商品"
                min-width="260"
              >
                <template #default="{ row }">
                  <div class="product-cell">
                    <el-image
                      class="table-thumb"
                      :src="row.imageUrl"
                      fit="cover"
                    >
                      <template #error>
                        <div class="table-thumb__empty">无图</div>
                      </template>
                    </el-image>
                    <div class="product-cell__text">
                      <strong>{{ row.name }}</strong>
                      <span>{{ row.subtitle || row.unit }}</span>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                label="单价"
                width="110"
                align="right"
              >
                <template #default="{ row }">
                  ¥{{ row.unitPriceText }}
                </template>
              </el-table-column>
              <el-table-column
                prop="quantity"
                label="数量"
                width="90"
                align="right"
              />
              <el-table-column
                label="小计"
                width="120"
                align="right"
              >
                <template #default="{ row }">
                  ¥{{ row.subtotalText }}
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <el-card
            v-if="order.cardMessage || order.buyerMessage || order.merchantNote"
            shadow="never"
            class="panel-card"
          >
            <template #header>
              <strong>备注信息</strong>
            </template>

            <div class="order-note-list">
              <div v-if="order.cardMessage">
                <span>贺卡内容</span>
                <p>{{ order.cardMessage }}</p>
              </div>
              <div v-if="order.buyerMessage">
                <span>买家留言</span>
                <p>{{ order.buyerMessage }}</p>
              </div>
              <div v-if="order.merchantNote">
                <span>商家备注</span>
                <p>{{ order.merchantNote }}</p>
              </div>
            </div>
          </el-card>
        </div>

        <aside class="admin-detail-side">
          <el-card
            shadow="never"
            class="panel-card order-action-card"
          >
            <template #header>
              <strong>订单处理</strong>
            </template>

            <template v-if="order.status === 'pendingConfirm'">
              <el-form label-position="top">
                <el-form-item label="配送费用（元）">
                  <el-input-number
                    v-model="actionForm.deliveryFeeYuan"
                    :min="0"
                    :precision="2"
                    :step="1"
                    :disabled="order.deliveryMethodId === 'pickup'"
                  />
                </el-form-item>
                <el-form-item label="商家备注">
                  <el-input
                    v-model="actionForm.note"
                    type="textarea"
                    :rows="3"
                    maxlength="200"
                    show-word-limit
                    placeholder="可填写花材替换、配送说明等"
                  />
                </el-form-item>
              </el-form>

              <el-button
                type="primary"
                :loading="actionLoading"
                @click="confirmCurrentOrder"
              >
                确认订单
              </el-button>
              <el-button
                :loading="actionLoading"
                @click="rejectCurrentOrder"
              >
                无法接单
              </el-button>
            </template>

            <template v-else-if="order.status === 'pendingPayment'">
              <p class="order-action-card__hint">
                V4.0 暂未接入微信支付。确认已通过线下方式收款后，可开始制作。
              </p>
              <el-button
                type="primary"
                :loading="actionLoading"
                @click="markPaid"
              >
                确认线下收款并开始制作
              </el-button>
            </template>

            <template v-else-if="order.status === 'making'">
              <el-input
                v-model="actionForm.note"
                type="textarea"
                :rows="3"
                placeholder="可填写配送员、预计送达时间等"
              />
              <el-button
                type="primary"
                :loading="actionLoading"
                @click="startCurrentDelivery"
              >
                开始配送
              </el-button>
            </template>

            <template v-else-if="order.status === 'delivering'">
              <el-input
                v-model="actionForm.note"
                type="textarea"
                :rows="3"
                placeholder="可填写签收说明"
              />
              <el-button
                type="primary"
                :loading="actionLoading"
                @click="completeCurrentOrder"
              >
                完成订单
              </el-button>
            </template>

            <template v-else>
              <el-empty
                :image-size="52"
                description="当前状态无需处理"
              />
            </template>

            <el-divider />

            <el-button
              v-if="['pendingConfirm', 'pendingPayment', 'making'].includes(order.status)"
              type="danger"
              plain
              :loading="actionLoading"
              @click="cancelCurrentOrder"
            >
              取消订单
            </el-button>
          </el-card>

          <el-card
            shadow="never"
            class="panel-card"
          >
            <template #header>
              <strong>费用明细</strong>
            </template>

            <div class="amount-summary-list">
              <div><span>商品金额</span><strong>¥{{ order.goodsAmountText }}</strong></div>
              <div><span>包装费用</span><strong>¥{{ order.packagingFeeText }}</strong></div>
              <div><span>配送费用</span><strong>{{ order.deliveryFeePending ? '待确认' : `¥${order.deliveryFeeText}` }}</strong></div>
              <div><span>优惠金额</span><strong>− ¥{{ order.discountText }}</strong></div>
              <div class="is-total"><span>应付金额</span><strong>¥{{ order.totalAmountText }}</strong></div>
            </div>
          </el-card>

          <el-card
            shadow="never"
            class="panel-card"
          >
            <template #header>
              <strong>订单进度</strong>
            </template>

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
import {
  computed,
  onMounted,
  reactive,
  ref
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import PageHeader from '../components/PageHeader.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const actionLoading = ref(false)
const order = ref(null)

const actionForm = reactive({
  deliveryFeeYuan: 0,
  note: ''
})

const paymentLabel = computed(() => {
  if (!order.value) return ''
  if (order.value.paymentStatus === 'offlinePaid') return '已确认线下收款'
  if (order.value.paymentStatus === 'paid') return '已付款'
  return '未付款'
})

function tagType(tone) {
  const map = {
    success: 'success',
    warning: 'warning',
    danger: 'danger',
    info: 'info',
    primary: 'primary'
  }
  return map[tone] || 'info'
}

function formatDateTime(value) {
  if (!value) return '时间未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

async function loadOrder() {
  loading.value = true

  try {
    order.value = await adminApi.getOrder(route.params.id)
    actionForm.deliveryFeeYuan = Number(order.value.deliveryFeeFen || 0) / 100
    actionForm.note = order.value.merchantNote || ''
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
    const { value } = await ElMessageBox.prompt(
      '请输入无法接单的原因，顾客会在订单详情中看到。',
      '无法接单',
      {
        confirmButtonText: '确认取消订单',
        cancelButtonText: '返回',
        inputPlaceholder: '例如：指定花材暂时缺货',
        inputValidator: (text) => Boolean(String(text || '').trim()) || '请输入原因'
      }
    )

    await runAction(
      () => adminApi.rejectOrder(order.value._id, value),
      '订单已取消'
    )
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      feedback.error(error, '取消订单失败')
    }
  }
}

function markPaid() {
  return runAction(
    () => adminApi.markOrderPaid(order.value._id, actionForm.note),
    '已确认收款，订单进入制作中'
  )
}

function startCurrentDelivery() {
  return runAction(
    () => adminApi.startDelivery(order.value._id, actionForm.note),
    '订单已开始配送'
  )
}

function completeCurrentOrder() {
  return runAction(
    () => adminApi.completeOrder(order.value._id, actionForm.note),
    '订单已完成'
  )
}

async function cancelCurrentOrder() {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入取消原因。',
      '取消订单',
      {
        confirmButtonText: '确认取消',
        cancelButtonText: '返回',
        inputPlaceholder: '取消原因',
        inputValidator: (text) => Boolean(String(text || '').trim()) || '请输入原因'
      }
    )

    await runAction(
      () => adminApi.cancelAdminOrder(order.value._id, value),
      '订单已取消'
    )
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      feedback.error(error, '取消订单失败')
    }
  }
}

onMounted(loadOrder)
</script>
