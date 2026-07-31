<template>
  <div>
    <PageHeader
      title="商品管理"
      description="维护商品信息、价格、库存和销售状态。"
    >
      <el-button
        type="primary"
        @click="router.push('/products/new')"
      >
        新增商品
      </el-button>
    </PageHeader>

    <el-card
      shadow="never"
      class="panel-card"
    >
      <div class="filter-bar">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索商品名称、SKU 或分类"
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

        <el-select v-model="filters.salesMode" clearable placeholder="全部销售模式" @change="loadProducts">
          <el-option label="现货销售" value="spot" />
          <el-option label="预约销售" value="preorder" />
        </el-select>

        <el-select v-model="filters.campaignId" clearable placeholder="全部活动" @change="loadProducts">
          <el-option v-for="item in campaigns" :key="item._id" :label="item.name" :value="item._id" />
        </el-select>

        <el-select
          v-model="filters.saleStatus"
          clearable
          placeholder="全部状态"
          @change="loadProducts"
        >
          <el-option
            label="正在销售"
            value="onSale"
          />
          <el-option
            label="已经下架"
            value="offSale"
          />
          <el-option label="等待自动上架 / 已自动下架" value="scheduled" />
          <el-option label="已经售罄" value="soldOut" />
        </el-select>

        <el-button
          :loading="loading"
          @click="loadProducts"
        >
          查询
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="products"
        row-key="_id"
        class="clean-table"
      >
        <el-table-column
          label="商品"
          min-width="280"
        >
          <template #default="{ row }">
            <div class="product-cell">
              <el-image
                class="table-thumb"
                :src="row.imageUrl"
                fit="cover"
              >
                <template #error>
                  <div class="table-thumb__empty">
                    无图
                  </div>
                </template>
              </el-image>

              <div class="product-cell__text">
                <strong>{{ row.name }}</strong>
                <span>{{ row.sku || '暂无 SKU' }} · {{ row.category || row.subtitle || '未分类' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="typeLabel"
          label="类型"
          width="110"
        />

        <el-table-column
          label="价格"
          width="130"
        >
          <template #default="{ row }">
            ¥{{ formatYuan(row.priceFen) }}
            / {{ row.unit }}
          </template>
        </el-table-column>

        <el-table-column label="销售模式" width="125">
          <template #default="{ row }">
            <el-tag :type="row.salesMode === 'preorder' ? 'warning' : 'success'" effect="plain">{{ row.salesModeLabel }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="活动 / 销售窗口" min-width="190">
          <template #default="{ row }">
            <div>{{ campaignName(row.festivalCampaignId) || '常规商品' }}</div>
            <el-tag size="small" :type="row.windowStatusTone" effect="plain">{{ row.windowStatusLabel }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column
          label="库存"
          width="100"
          align="right"
        >
          <template #default="{ row }">
            <span
              :class="[
                'stock-text',
                row.stock === 0
                  ? 'is-empty'
                  : row.stock <= 5
                    ? 'is-low'
                    : ''
              ]"
            >
              {{ row.stock }}{{ row.unit }}
            </span>
          </template>
        </el-table-column>

        <el-table-column
          label="上架"
          width="90"
          align="center"
        >
          <template #default="{ row }">
            <el-switch
              v-model="row.onSale"
              @change="
                toggle(
                  row,
                  'onSale',
                  row.onSale
                )
              "
            />
          </template>
        </el-table-column>

        <el-table-column
          label="推荐"
          width="90"
          align="center"
        >
          <template #default="{ row }">
            <el-switch
              v-model="row.featured"
              @change="
                toggle(
                  row,
                  'featured',
                  row.featured
                )
              "
            />
          </template>
        </el-table-column>

        <el-table-column
          prop="sort"
          label="排序"
          width="80"
          align="right"
        />

        <el-table-column
          label="操作"
          width="140"
          fixed="right"
          align="right"
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="
                router.push(
                  `/products/${row._id}`
                )
              "
            >
              编辑
            </el-button>
            <el-button
              link
              type="danger"
              @click="removeProduct(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && !products.length"
        :image-size="64"
        description="没有匹配的商品"
      />
    </el-card>
  </div>
</template>

<script setup>
import {
  onMounted,
  reactive,
  ref
} from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import PageHeader from '../components/PageHeader.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const router = useRouter()
const loading = ref(false)
const products = ref([])
const campaigns = ref([])

const filters = reactive({
  keyword: '',
  type: '',
  saleStatus: '',
  salesMode: '',
  campaignId: ''
})

const typeOptions = [
  {
    label: '鲜切花材',
    value: 'flower'
  },
  {
    label: '成品花束',
    value: 'bouquet'
  },
  {
    label: '多肉植物',
    value: 'succulent'
  },
  {
    label: '绿植',
    value: 'greenPlant'
  },
  {
    label: '花器',
    value: 'vase'
  },
  {
    label: '礼品',
    value: 'gift'
  },
  {
    label: '花艺工具',
    value: 'tool'
  }
]

function campaignName(id) { return campaigns.value.find((item) => item._id === id)?.name || '' }

function formatYuan(priceFen) {
  return (
    Number(priceFen || 0) / 100
  ).toFixed(2)
}

async function loadProducts() {
  loading.value = true

  try {
    const result =
      await adminApi.listProducts(
        filters
      )

    products.value = result.items || []
  } catch (error) {
    feedback.error(
      error,
      '商品列表加载失败'
    )
  } finally {
    loading.value = false
  }
}

async function toggle(
  row,
  field,
  value
) {
  try {
    await adminApi.toggleProduct(
      row._id,
      field,
      value
    )
  } catch (error) {
    row[field] = !value

    feedback.error(
      error,
      '状态更新失败'
    )
  }
}

async function removeProduct(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除“${row.name}”吗？`,
      '删除商品',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await adminApi.deleteProduct(
      row._id
    )

    feedback.success('商品已删除')
    loadProducts()
  } catch (error) {
    if (
      error !== 'cancel' &&
      error !== 'close'
    ) {
      feedback.error(
        error,
        '删除商品失败'
      )
    }
  }
}

onMounted(async () => {
  try { campaigns.value = (await adminApi.listFestivalCampaigns()).items || [] } catch (error) {}
  await loadProducts()
})
</script>
