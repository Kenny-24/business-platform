<template>
  <div>
    <PageHeader
      title="商品管理"
      description="维护鲜花、成品花束、多肉、绿植、花器与礼品。"
    >
      <el-button type="primary" @click="createProduct">
        新增商品
      </el-button>
    </PageHeader>

    <el-card shadow="never" class="panel-card">
      <div class="filter-bar">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索商品名称"
          @keyup.enter="loadProducts"
          @clear="loadProducts"
        />

        <el-select
          v-model="filters.type"
          clearable
          placeholder="全部类型"
          @change="loadProducts"
        >
          <el-option
            v-for="option in typeOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>

        <el-select
          v-model="filters.saleStatus"
          clearable
          placeholder="全部状态"
          @change="loadProducts"
        >
          <el-option label="正在销售" value="onSale" />
          <el-option label="已经下架" value="offSale" />
          <el-option label="已经售罄" value="soldOut" />
        </el-select>

        <el-button :loading="loading" @click="loadProducts">
          查询
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="products"
        row-key="_id"
      >
        <el-table-column label="商品" min-width="260">
          <template #default="{ row }">
            <div class="product-cell">
              <el-image
                class="product-cell__image"
                :src="row.imageUrl"
                fit="cover"
              >
                <template #error>
                  <div class="image-fallback">花予</div>
                </template>
              </el-image>

              <div>
                <strong>{{ row.name }}</strong>
                <span>{{ row.subtitle || '—' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="typeLabel"
          label="类型"
          width="110"
        />

        <el-table-column label="价格" width="130">
          <template #default="{ row }">
            ¥{{ formatYuan(row.priceFen) }} / {{ row.unit }}
          </template>
        </el-table-column>

        <el-table-column label="库存" width="100">
          <template #default="{ row }">
            <el-tag
              :type="row.stock === 0 ? 'danger' : row.stock <= 5 ? 'warning' : 'success'"
              effect="plain"
            >
              {{ row.stock }}{{ row.unit }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="上架" width="90">
          <template #default="{ row }">
            <el-switch
              v-model="row.onSale"
              @change="toggle(row, 'onSale', row.onSale)"
            />
          </template>
        </el-table-column>

        <el-table-column label="首页推荐" width="110">
          <template #default="{ row }">
            <el-switch
              v-model="row.featured"
              @change="toggle(row, 'featured', row.featured)"
            />
          </template>
        </el-table-column>

        <el-table-column prop="sort" label="排序" width="80" />

        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="editProduct(row)">
              编辑
            </el-button>
            <el-button link type="danger" @click="removeProduct(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && !products.length"
        description="没有匹配的商品"
      />
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import PageHeader from '../components/PageHeader.vue'
import { adminApi } from '../services/admin'

const router = useRouter()
const loading = ref(false)
const products = ref([])

const filters = reactive({
  keyword: '',
  type: '',
  saleStatus: ''
})

const typeOptions = [
  { label: '鲜切花材', value: 'flower' },
  { label: '成品花束', value: 'bouquet' },
  { label: '多肉植物', value: 'succulent' },
  { label: '绿植', value: 'greenPlant' },
  { label: '花器', value: 'vase' },
  { label: '礼品', value: 'gift' }
]

function formatYuan(priceFen) {
  return (Number(priceFen || 0) / 100).toFixed(2)
}

async function loadProducts() {
  loading.value = true

  try {
    const result = await adminApi.listProducts(filters)
    products.value = result.items || []
  } catch (error) {
    ElMessage.error(error.message || '商品列表加载失败')
  } finally {
    loading.value = false
  }
}

function createProduct() {
  router.push('/products/new')
}

function editProduct(row) {
  router.push(`/products/${row._id}`)
}

async function toggle(row, field, value) {
  try {
    await adminApi.toggleProduct(row._id, field, value)
    ElMessage.success('状态已更新')
  } catch (error) {
    row[field] = !value
    ElMessage.error(error.message || '状态更新失败')
  }
}

async function removeProduct(row) {
  await ElMessageBox.confirm(
    `确定删除“${row.name}”吗？删除后无法恢复。`,
    '删除商品',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )

  try {
    await adminApi.deleteProduct(row._id)
    ElMessage.success('商品已删除')
    loadProducts()
  } catch (error) {
    ElMessage.error(error.message || '删除失败')
  }
}

onMounted(loadProducts)
</script>
