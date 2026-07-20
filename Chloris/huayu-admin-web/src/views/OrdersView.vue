<template>
  <div>
    <PageHeader
      title="订单管理"
      description="确认订单、核对配送费用并跟进制作与配送状态。"
    >
      <el-button
        :loading="loading"
        @click="loadOrders"
      >
        刷新
      </el-button>
    </PageHeader>

    <section class="order-metric-grid">
      <button
        v-for="metric in statusMetrics"
        :key="metric.key"
        type="button"
        :class="[
          'order-metric-card',
          filters.status === metric.key
            ? 'is-active'
            : ''
        ]"
        @click="selectStatus(metric.key)"
      >
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
      </button>
    </section>

    <el-card
      shadow="never"
      class="panel-card"
    >
      <div class="filter-bar order-filter-bar">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索订单号、姓名、手机号或商品"
          @keyup.enter="loadOrders"
          @clear="loadOrders"
        />

        <el-select
          v-model="filters.status"
          clearable
          placeholder="全部状态"
          @change="loadOrders"
        >
          <el-option
            v-for="option in statusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>

        <el-select
          v-model="filters.deliveryMethodId"
          clearable
          placeholder="全部收货方式"
          @change="loadOrders"
        >
          <el-option
            label="配送到家"
            value="delivery"
          />
        </el-select>

        <el-button
          :loading="loading"
          @click="loadOrders"
        >
          查询
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="orders"
        row-key="_id"
        class="clean-table"
      >
        <el-table-column
          label="订单"
          min-width="210"
        >
          <template #default="{ row }">
            <div class="order-number-cell">
              <strong>{{ row.orderNo }}</strong>
              <span>{{ formatDateTime(row.createdAtText) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          label="顾客"
          min-width="180"
        >
          <template #default="{ row }">
            <div class="order-customer-cell">
              <strong>
                {{ row.address?.receiverName || row.customerNickname }}
              </strong>
              <span>
                {{ row.address?.phoneMasked || '未填写手机号' }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          label="商品"
          min-width="250"
        >
          <template #default="{ row }">
            <div class="order-product-summary">
              <el-image
                class="table-thumb"
                :src="row.items?.[0]?.imageUrl"
                fit="cover"
              >
                <template #error>
                  <div class="table-thumb__empty">
                    无图
                  </div>
                </template>
              </el-image>

              <div>
                <strong>
                  {{ row.items?.[0]?.name || '商品信息缺失' }}
                </strong>
                <span>
                  共 {{ row.itemCount || 0 }} 件
                  <template v-if="row.items?.length > 1">
                    · {{ row.items.length }} 种商品
                  </template>
                </span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          label="配送"
          min-width="180"
        >
          <template #default="{ row }">
            <div class="order-delivery-cell">
              <strong>{{ row.deliveryMethodName }}</strong>
              <span>{{ row.requestedDeliveryDate || row.deliveryDate || '未填写日期' }} {{ row.requestedDeliverySlot || row.deliverySlot || '未填写时段' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          label="金额"
          width="120"
          align="right"
        >
          <template #default="{ row }">
            <div class="order-amount-cell">
              <strong>¥{{ row.totalAmountText }}</strong>
              <span v-if="row.amountPending">
                配送费待确认
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          label="状态"
          width="110"
          align="center"
        >
          <template #default="{ row }">
            <el-tag
              :type="tagType(row.statusTone)"
              effect="plain"
              round
            >
              {{ row.statusLabel }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column
          label="操作"
          width="100"
          fixed="right"
          align="right"
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="router.push(`/orders/${row._id}`)"
            >
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && !orders.length"
        :image-size="64"
        description="没有匹配的订单"
      />
    </el-card>
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
import PageHeader from '../components/PageHeader.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const orders = ref([])
const counts = reactive({
  all: 0,
  pendingConfirm: 0,
  pendingPayment: 0,
  making: 0,
  delivering: 0,
  completed: 0,
  cancelled: 0
})

const filters = reactive({
  keyword: '',
  status: String(route.query.status || ''),
  deliveryMethodId: ''
})

const statusOptions = [
  { label: '待确认', value: 'pendingConfirm' },
  { label: '待付款', value: 'pendingPayment' },
  { label: '制作中', value: 'making' },
  { label: '配送中', value: 'delivering' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
  { label: '退款中', value: 'refundPending' },
  { label: '已退款', value: 'refunded' }
]

const statusMetrics = computed(() => [
  { key: '', label: '全部订单', value: counts.all },
  { key: 'pendingConfirm', label: '待确认', value: counts.pendingConfirm },
  { key: 'pendingPayment', label: '待付款', value: counts.pendingPayment },
  { key: 'making', label: '制作中', value: counts.making },
  { key: 'delivering', label: '配送中', value: counts.delivering },
  { key: 'completed', label: '已完成', value: counts.completed }
])

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

function selectStatus(status) {
  filters.status = status
  loadOrders()
}

async function loadOrders() {
  loading.value = true

  try {
    const result = await adminApi.listOrders(filters)
    orders.value = result.items || []
    Object.assign(counts, result.counts || {})
  } catch (error) {
    feedback.error(error, '订单列表加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadOrders)
</script>
