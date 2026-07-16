<template>
  <div>
    <PageHeader
      title="库存管理"
      description="快速调整实际可售库存。"
    >
      <el-button
        :loading="loading"
        @click="loadProducts"
      >
        刷新
      </el-button>
    </PageHeader>

    <el-card
      shadow="never"
      class="panel-card"
    >
      <div class="inventory-toolbar">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索商品"
        />
        <span>
          修改后自动保存
        </span>
      </div>

      <div
        v-loading="loading"
        class="inventory-list"
      >
        <div
          v-for="item in filteredProducts"
          :key="item._id"
          class="inventory-row"
        >
          <div class="product-cell">
            <el-image
              class="table-thumb"
              :src="item.imageUrl"
              fit="cover"
            >
              <template #error>
                <div class="table-thumb__empty">
                  无图
                </div>
              </template>
            </el-image>

            <div class="product-cell__text">
              <strong>{{ item.name }}</strong>
              <span>
                {{ item.typeLabel }}
                · ¥{{ formatYuan(item.priceFen) }}
                / {{ item.unit }}
              </span>
            </div>
          </div>

          <div class="inventory-controls">
            <el-button
              size="small"
              @click="adjust(item, -10)"
            >
              -10
            </el-button>
            <el-button
              size="small"
              @click="adjust(item, -1)"
            >
              -1
            </el-button>

            <el-input-number
              v-model="item.stock"
              :min="0"
              :step="1"
              controls-position="right"
              @change="queueSave(item)"
            />

            <el-button
              size="small"
              @click="adjust(item, 1)"
            >
              +1
            </el-button>
            <el-button
              size="small"
              @click="adjust(item, 10)"
            >
              +10
            </el-button>

            <span
              :class="[
                'stock-text',
                item.stock === 0
                  ? 'is-empty'
                  : item.stock <= 5
                    ? 'is-low'
                    : ''
              ]"
            >
              {{ item.stock }}{{ item.unit }}
            </span>
          </div>
        </div>

        <el-empty
          v-if="
            !loading &&
            !filteredProducts.length
          "
          :image-size="64"
          description="没有商品"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref
} from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const loading = ref(false)
const products = ref([])
const keyword = ref('')
const timers = new Map()

const filteredProducts = computed(() => {
  const key = keyword.value
    .trim()
    .toLowerCase()

  if (!key) {
    return products.value
  }

  return products.value.filter(
    (item) =>
      item.name
        .toLowerCase()
        .includes(key)
  )
})

function formatYuan(priceFen) {
  return (
    Number(priceFen || 0) / 100
  ).toFixed(2)
}

async function loadProducts() {
  loading.value = true

  try {
    const result =
      await adminApi.listProducts()

    products.value = result.items || []
  } catch (error) {
    feedback.error(
      error,
      '库存数据加载失败'
    )
  } finally {
    loading.value = false
  }
}

function adjust(item, delta) {
  item.stock = Math.max(
    0,
    Number(item.stock || 0) + delta
  )

  queueSave(item)
}

function queueSave(item) {
  if (timers.has(item._id)) {
    clearTimeout(
      timers.get(item._id)
    )
  }

  const timer = setTimeout(
    async () => {
      try {
        await adminApi.updateStock(
          item._id,
          Number(item.stock || 0)
        )
      } catch (error) {
        feedback.error(
          error,
          '库存更新失败'
        )
        loadProducts()
      } finally {
        timers.delete(item._id)
      }
    },
    450
  )

  timers.set(item._id, timer)
}

onMounted(loadProducts)

onBeforeUnmount(() => {
  for (const timer of timers.values()) {
    clearTimeout(timer)
  }
})
</script>
