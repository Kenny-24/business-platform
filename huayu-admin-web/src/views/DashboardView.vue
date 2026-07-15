<template>
  <div>
    <PageHeader
      title="经营概览"
      description="查看当前商品、库存和首页内容的整体状态。"
    >
      <el-button :loading="loading" @click="loadData">
        刷新数据
      </el-button>
    </PageHeader>

    <div class="metric-grid">
      <article
        v-for="metric in metrics"
        :key="metric.label"
        class="metric-card"
      >
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <small>{{ metric.caption }}</small>
      </article>
    </div>

    <div class="dashboard-grid">
      <el-card shadow="never" class="panel-card">
        <template #header>
          <div class="panel-title">
            <strong>库存提醒</strong>
            <RouterLink to="/inventory">
              管理库存 →
            </RouterLink>
          </div>
        </template>

        <el-empty
          v-if="!data.lowStockProducts?.length"
          description="暂时没有低库存商品"
        />

        <div v-else class="notice-list">
          <div
            v-for="item in data.lowStockProducts"
            :key="item._id"
            class="notice-row"
          >
            <div>
              <strong>{{ item.name }}</strong>
              <span>{{ item.typeLabel }}</span>
            </div>
            <el-tag
              :type="item.stock === 0 ? 'danger' : 'warning'"
              effect="plain"
            >
              {{ item.stock === 0 ? '已售罄' : `${item.stock}${item.unit}` }}
            </el-tag>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="panel-card">
        <template #header>
          <div class="panel-title">
            <strong>内容状态</strong>
          </div>
        </template>

        <div class="content-status">
          <div>
            <span>启用轮播</span>
            <strong>{{ data.enabledBanners || 0 }}</strong>
          </div>
          <div>
            <span>图鉴内容</span>
            <strong>{{ data.atlasCount || 0 }}</strong>
          </div>
          <div>
            <span>首页推荐商品</span>
            <strong>{{ data.featuredProducts || 0 }}</strong>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '../components/PageHeader.vue'
import { adminApi } from '../services/admin'

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
    caption: '鲜花、花束、多肉与绿植'
  },
  {
    label: '正在销售',
    value: data.onSaleProducts,
    caption: '当前顾客可以购买'
  },
  {
    label: '库存紧张',
    value: data.lowStockCount,
    caption: '库存不高于 5'
  },
  {
    label: '已经售罄',
    value: data.soldOutProducts,
    caption: '库存为 0 的商品'
  }
])

async function loadData() {
  loading.value = true

  try {
    Object.assign(data, await adminApi.dashboard())
  } catch (error) {
    ElMessage.error(error.message || '经营数据加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>
