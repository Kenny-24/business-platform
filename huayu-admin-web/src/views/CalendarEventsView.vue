<template>
  <div>
    <PageHeader
      title="节日管理"
      description="内置国内传统节日与海外重大节日，可配置推荐文案、关键词和关联商品。"
    >
      <el-button type="primary" @click="openCreate">
        新增自定义节日
      </el-button>
    </PageHeader>

    <el-alert
      v-if="!collectionReady"
      class="collection-alert"
      type="warning"
      :closable="false"
      title="内置节日已可在小程序展示。要保存修改，请先在 CloudBase 数据库创建空集合 calendarEvents。"
    />

    <el-card shadow="never" class="panel-card">
      <div class="filter-bar event-filter-bar">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索节日名称或推荐文案"
        />

        <el-select v-model="filters.region" clearable placeholder="全部分类">
          <el-option label="国内节日" value="domestic" />
          <el-option label="国际节日" value="international" />
        </el-select>

        <el-select v-model="filters.status" clearable placeholder="全部状态">
          <el-option label="已启用" value="enabled" />
          <el-option label="已停用" value="disabled" />
        </el-select>

        <el-button :loading="loading" @click="loadData">
          刷新
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="filteredItems"
        row-key="eventKey"
      >
        <el-table-column label="分类" width="105">
          <template #default="{ row }">
            <span :class="['region-badge', `is-${row.region}`]">
              {{ row.region === 'international' ? '国际' : '国内' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="节日" min-width="190">
          <template #default="{ row }">
            <div class="event-name-cell">
              <strong>{{ row.name }}</strong>
              <span>{{ row.builtIn ? '内置真实节日' : '自定义节日' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="日期规则" min-width="180">
          <template #default="{ row }">
            {{ formatRule(row.rule) }}
          </template>
        </el-table-column>

        <el-table-column label="推荐文案" min-width="240">
          <template #default="{ row }">
            <div class="event-copy-cell">
              <strong>{{ row.title || row.name }}</strong>
              <span>{{ row.description || '未配置说明' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="关联商品" width="100" align="center">
          <template #default="{ row }">
            {{ row.productIds?.length || 0 }}
          </template>
        </el-table-column>

        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <StatusDot
              :text="row.enabled ? '启用' : '停用'"
              :type="row.enabled ? 'success' : 'muted'"
            />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="165" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button
              link
              type="danger"
              @click="removeOrReset(row)"
            >
              {{ row.builtIn ? '恢复默认' : '删除' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && !filteredItems.length"
        :image-size="64"
        description="没有匹配的节日"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="form.builtIn ? '编辑内置节日配置' : form.eventKey ? '编辑自定义节日' : '新增自定义节日'"
      width="760px"
      destroy-on-close
    >
      <el-form label-position="top">
        <div class="two-column">
          <el-form-item label="节日名称" required>
            <el-input v-model="form.name" :disabled="form.builtIn" />
          </el-form-item>

          <el-form-item label="节日分类" required>
            <el-select v-model="form.region" :disabled="form.builtIn">
              <el-option label="国内节日" value="domestic" />
              <el-option label="国际节日" value="international" />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item v-if="form.builtIn" label="日期规则">
          <el-input :model-value="formatRule(form.rule)" disabled />
        </el-form-item>

        <div v-else class="two-column">
          <el-form-item label="公历月份" required>
            <el-input-number
              v-model="form.month"
              :min="1"
              :max="12"
              controls-position="right"
            />
          </el-form-item>

          <el-form-item label="公历日期" required>
            <el-input-number
              v-model="form.day"
              :min="1"
              :max="31"
              controls-position="right"
            />
          </el-form-item>
        </div>

        <el-form-item label="推荐标题">
          <el-input v-model="form.title" placeholder="例如：送给妈妈的花" />
        </el-form-item>

        <el-form-item label="节日说明">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="显示在小程序日历的简洁说明"
          />
        </el-form-item>

        <div class="two-column">
          <el-form-item label="推荐分类">
            <el-select v-model="form.categoryIntent">
              <el-option
                v-for="category in categoryOptions"
                :key="category"
                :label="category"
                :value="category"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="排序值">
            <el-input-number
              v-model="form.sort"
              :min="0"
              :max="9999"
              controls-position="right"
            />
          </el-form-item>
        </div>

        <el-form-item label="搜索关键词">
          <el-select
            v-model="form.searchKeywords"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入关键词后回车，例如：母亲节、康乃馨"
          />
        </el-form-item>

        <el-form-item label="关联当前商品">
          <el-select
            v-model="form.productIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="可直接指定节日推荐商品"
          >
            <el-option
              v-for="product in products"
              :key="product._id"
              :label="`${product.name} · ¥${formatYuan(product.priceFen)}/${product.unit}`"
              :value="product._id"
            />
          </el-select>
        </el-form-item>

        <div class="switch-list">
          <div class="switch-row">
            <div>
              <strong>显示节日</strong>
              <span>关闭后不在小程序日历中显示</span>
            </div>
            <el-switch v-model="form.enabled" />
          </div>

          <div class="switch-row">
            <div>
              <strong>显示选花入口</strong>
              <span>庄重纪念类节日可以关闭商品推荐</span>
            </div>
            <el-switch v-model="form.recommendationEnabled" />
          </div>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="!collectionReady"
          @click="save"
        >
          保存配置
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import PageHeader from '../components/PageHeader.vue'
import StatusDot from '../components/StatusDot.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const collectionReady = ref(true)
const items = ref([])
const products = ref([])

const filters = reactive({
  keyword: '',
  region: '',
  status: ''
})

const categoryOptions = [
  '成品花束',
  '鲜花',
  '绿植',
  '多肉植物',
  '礼品'
]

const emptyForm = () => ({
  eventKey: '',
  builtIn: false,
  name: '',
  region: 'domestic',
  rule: null,
  month: 1,
  day: 1,
  title: '',
  description: '',
  categoryIntent: '成品花束',
  searchKeywords: [],
  productIds: [],
  recommendationEnabled: true,
  enabled: true,
  sort: 100
})

const form = reactive(emptyForm())

const filteredItems = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()

  return items.value.filter((item) => {
    if (
      keyword &&
      ![
        item.name,
        item.title,
        item.description,
        ...(item.searchKeywords || [])
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    ) {
      return false
    }

    if (filters.region && item.region !== filters.region) return false
    if (filters.status === 'enabled' && item.enabled !== true) return false
    if (filters.status === 'disabled' && item.enabled === true) return false
    return true
  })
})

function formatYuan(priceFen) {
  return (Number(priceFen || 0) / 100).toFixed(2)
}

function formatRule(rule) {
  if (!rule) return '未设置'
  if (rule.type === 'fixed') return `每年 ${rule.month} 月 ${rule.day} 日`
  if (rule.type === 'lunar') return `农历 ${rule.month} 月 ${rule.day} 日`
  if (rule.type === 'lunarLastDay') return '农历年最后一天（除夕）'
  if (rule.type === 'nthWeekday') {
    const weeks = ['日', '一', '二', '三', '四', '五', '六']
    return `每年 ${rule.month} 月第 ${rule.nth} 个星期${weeks[rule.weekday]}`
  }
  if (rule.type === 'easterOffset') {
    const offset = Number(rule.offsetDays || 0)
    if (offset === 0) return '西方复活节'
    return `西方复活节${offset > 0 ? '后' : '前'} ${Math.abs(offset)} 天`
  }
  if (rule.type === 'solarTerm') {
    return rule.term === 'qingming' ? '清明节气日' : '冬至节气日'
  }
  return '自定义日期规则'
}

function resetForm(data = {}) {
  const next = { ...emptyForm(), ...data }
  if (!next.builtIn && next.rule?.type === 'fixed') {
    next.month = Number(next.rule.month || 1)
    next.day = Number(next.rule.day || 1)
  }
  next.searchKeywords = [...(next.searchKeywords || [])]
  next.productIds = [...(next.productIds || [])]
  Object.assign(form, next)
}

async function loadData() {
  loading.value = true

  try {
    const [eventResult, productResult] = await Promise.all([
      adminApi.listCalendarEvents(),
      adminApi.listProducts()
    ])

    items.value = eventResult.items || []
    collectionReady.value = eventResult.collectionReady !== false
    products.value = productResult.items || []
  } catch (error) {
    feedback.error(error, '节日配置加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row) {
  resetForm(row)
  dialogVisible.value = true
}

async function save() {
  if (!form.name.trim()) {
    feedback.warning('请输入节日名称')
    return
  }

  saving.value = true

  try {
    await adminApi.saveCalendarEvent({
      ...form,
      rule: form.builtIn
        ? form.rule
        : {
            type: 'fixed',
            month: Number(form.month),
            day: Number(form.day)
          }
    })

    feedback.success('节日配置已保存')
    dialogVisible.value = false
    await loadData()
  } catch (error) {
    feedback.error(error, '保存节日配置失败')
  } finally {
    saving.value = false
  }
}

async function removeOrReset(row) {
  try {
    await ElMessageBox.confirm(
      row.builtIn
        ? `确定将“${row.name}”恢复为内置默认配置吗？`
        : `确定删除自定义节日“${row.name}”吗？`,
      row.builtIn ? '恢复默认' : '删除节日',
      {
        confirmButtonText: row.builtIn ? '恢复' : '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await adminApi.deleteCalendarEvent(row.eventKey)
    feedback.success(row.builtIn ? '已恢复默认配置' : '自定义节日已删除')
    await loadData()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      feedback.error(error, row.builtIn ? '恢复失败' : '删除失败')
    }
  }
}

onMounted(loadData)
</script>

<style scoped>
.collection-alert {
  margin-bottom: 16px;
}

.event-filter-bar .el-input {
  width: 300px;
}

.region-badge {
  display: inline-flex;
  min-width: 52px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  font-size: 12px;
}

.region-badge.is-domestic {
  background: #faeeee;
  color: #b7555e;
}

.region-badge.is-international {
  background: #eef2f8;
  color: #5873a5;
}

.event-name-cell strong,
.event-name-cell span,
.event-copy-cell strong,
.event-copy-cell span {
  display: block;
}

.event-name-cell span,
.event-copy-cell span {
  margin-top: 4px;
  overflow: hidden;
  color: #8d928a;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.two-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.switch-list {
  border-top: 1px solid #ecefe9;
}

.switch-row {
  display: flex;
  min-height: 66px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #ecefe9;
}

.switch-row strong,
.switch-row span {
  display: block;
}

.switch-row span {
  margin-top: 4px;
  color: #8d928a;
  font-size: 12px;
}
</style>
