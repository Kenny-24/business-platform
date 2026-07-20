<template>
  <div>
    <PageHeader
      title="经营概览"
      description="优先查看待处理订单，再关注商品、库存与内容状态。"
    >
      <el-button
        :loading="loading"
        @click="loadData"
      >
        刷新
      </el-button>
    </PageHeader>

    <section class="metric-grid">
      <article
        v-for="metric in metrics"
        :key="metric.label"
        class="metric-card"
      >
        <div class="metric-card__label">
          {{ metric.label }}
        </div>
        <div class="metric-card__value">
          {{ metric.value }}
        </div>
        <div class="metric-card__note">
          {{ metric.note }}
        </div>
      </article>
    </section>

    <section class="dashboard-grid dashboard-grid--orders">
      <el-card
        shadow="never"
        class="panel-card"
      >
        <template #header>
          <div class="panel-header">
            <strong>订单处理</strong>
            <RouterLink to="/orders">
              查看全部订单
            </RouterLink>
          </div>
        </template>

        <div class="dashboard-order-status">
          <RouterLink
            v-for="item in orderStatus"
            :key="item.label"
            :to="item.path"
            class="dashboard-order-status__item"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </RouterLink>
        </div>

        <div class="dashboard-order-note">
          当前订单流程支持商家确认、线下收款、制作、配送与完成。微信支付和自动库存锁定尚未接入。
        </div>
      </el-card>

      <el-card
        shadow="never"
        class="panel-card"
      >
        <template #header>
          <div class="panel-header">
            <strong>经营数据</strong>
            <RouterLink to="/users">
              查看顾客
            </RouterLink>
          </div>
        </template>

        <div class="content-summary content-summary--business">
          <div class="content-summary__item">
            <span>顾客</span>
            <strong>{{ data.customerCount || 0 }}</strong>
          </div>
          <div class="content-summary__item">
            <span>全部订单</span>
            <strong>{{ data.orderCount || 0 }}</strong>
          </div>
          <div class="content-summary__item">
            <span>已完成金额</span>
            <strong>¥{{ completedRevenue }}</strong>
          </div>
        </div>
      </el-card>
    </section>

    <section class="dashboard-grid">
      <el-card
        shadow="never"
        class="panel-card"
      >
        <template #header>
          <div class="panel-header">
            <strong>库存提醒</strong>
            <RouterLink to="/inventory">
              查看库存
            </RouterLink>
          </div>
        </template>

        <el-table
          v-if="data.lowStockProducts?.length"
          :data="data.lowStockProducts"
          size="small"
        >
          <el-table-column
            prop="name"
            label="商品"
            min-width="180"
          />
          <el-table-column
            prop="typeLabel"
            label="类型"
            width="110"
          />
          <el-table-column
            label="库存"
            width="110"
            align="right"
          >
            <template #default="{ row }">
              <span
                :class="[
                  'stock-text',
                  row.stock === 0
                    ? 'is-empty'
                    : 'is-low'
                ]"
              >
                {{ row.stock }}{{ row.unit }}
              </span>
            </template>
          </el-table-column>
        </el-table>

        <el-empty
          v-else
          :image-size="64"
          description="暂无低库存商品"
        />
      </el-card>

      <el-card
        shadow="never"
        class="panel-card"
      >
        <template #header>
          <div class="panel-header">
            <strong>商品与内容</strong>
          </div>
        </template>

        <div class="content-summary">
          <div class="content-summary__item">
            <span>正在销售</span>
            <strong>{{ data.onSaleProducts || 0 }}</strong>
          </div>
          <div class="content-summary__item">
            <span>首页推荐</span>
            <strong>{{ data.featuredProducts || 0 }}</strong>
          </div>
          <div class="content-summary__item">
            <span>图鉴内容</span>
            <strong>{{ data.atlasCount || 0 }}</strong>
          </div>
        </div>

        <div class="quick-actions">
          <RouterLink to="/products/new">
            新增商品
          </RouterLink>
          <RouterLink to="/orders">
            处理订单
          </RouterLink>
          <RouterLink to="/atlas">
            管理图鉴
          </RouterLink>
          <RouterLink to="/quote-requests">
            处理图片报价
          </RouterLink>
        </div>
      </el-card>
    </section>
  </div>
</template>

<script setup>
import {
  computed,
  onMounted,
  reactive,
  ref
} from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const loading = ref(false)

const data = reactive({
  productCount: 0,
  onSaleProducts: 0,
  soldOutProducts: 0,
  lowStockCount: 0,
  featuredProducts: 0,
  enabledBanners: 0,
  atlasCount: 0,
  customerCount: 0,
  orderCount: 0,
  pendingConfirmOrders: 0,
  pendingPaymentOrders: 0,
  makingOrders: 0,
  deliveringOrders: 0,
  completedOrders: 0,
  completedRevenueFen: 0,
  lowStockProducts: [],
  quoteRequestCount: 0,
  pendingQuoteRequests: 0
})

const completedRevenue = computed(() => {
  const yuan = Number(data.completedRevenueFen || 0) / 100
  return Number.isInteger(yuan)
    ? String(yuan)
    : yuan.toFixed(2)
})

const metrics = computed(() => [
  {
    label: '待确认订单',
    value: data.pendingConfirmOrders,
    note: '需要尽快确认库存与配送'
  },
  {
    label: '待付款订单',
    value: data.pendingPaymentOrders,
    note: '已确认，等待顾客付款'
  },
  {
    label: '制作中',
    value: data.makingOrders,
    note: '已经收款并进入制作'
  },
  {
    label: '配送中',
    value: data.deliveringOrders,
    note: '正在配送的订单'
  },
  {
    label: '待回复图片报价',
    value: data.pendingQuoteRequests,
    note: '顾客上传参考图后等待报价'
  }
])

const orderStatus = computed(() => [
  {
    label: '待确认',
    value: data.pendingConfirmOrders,
    path: '/orders?status=pendingConfirm'
  },
  {
    label: '待付款',
    value: data.pendingPaymentOrders,
    path: '/orders?status=pendingPayment'
  },
  {
    label: '制作中',
    value: data.makingOrders,
    path: '/orders?status=making'
  },
  {
    label: '配送中',
    value: data.deliveringOrders,
    path: '/orders?status=delivering'
  },
  {
    label: '已完成',
    value: data.completedOrders,
    path: '/orders?status=completed'
  }
])

async function loadData() {
  loading.value = true

  try {
    Object.assign(
      data,
      await adminApi.dashboard()
    )
  } catch (error) {
    feedback.error(
      error,
      '经营数据加载失败'
    )
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>
