<template>
  <div>
    <PageHeader
      title="经营概览"
      description="查看商品、库存和内容的当前状态。"
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
            <strong>内容状态</strong>
          </div>
        </template>

        <div class="content-summary">
          <div class="content-summary__item">
            <span>首页推荐商品</span>
            <strong>
              {{ data.featuredProducts || 0 }}
            </strong>
          </div>
          <div class="content-summary__item">
            <span>启用轮播</span>
            <strong>
              {{ data.enabledBanners || 0 }}
            </strong>
          </div>
          <div class="content-summary__item">
            <span>图鉴内容</span>
            <strong>
              {{ data.atlasCount || 0 }}
            </strong>
          </div>
        </div>

        <div class="quick-actions">
          <RouterLink to="/products/new">
            新增商品
          </RouterLink>
          <RouterLink to="/banners">
            管理轮播
          </RouterLink>
          <RouterLink to="/atlas">
            管理图鉴
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
  lowStockProducts: []
})

const metrics = computed(() => [
  {
    label: '全部商品',
    value: data.productCount,
    note: '全部商品记录'
  },
  {
    label: '正在销售',
    value: data.onSaleProducts,
    note: '当前已上架'
  },
  {
    label: '低库存',
    value: data.lowStockCount,
    note: '库存不高于 5'
  },
  {
    label: '已售罄',
    value: data.soldOutProducts,
    note: '库存为 0'
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
