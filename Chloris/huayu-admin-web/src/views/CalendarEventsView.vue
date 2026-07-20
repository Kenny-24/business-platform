<template>
  <div>
    <PageHeader
      title="节日与活动管理"
      description="管理国内外节日、商家活动日、活动信息及关联商品，小程序日历会同步展示。"
    >
      <el-button type="primary" @click="openCreate('merchant')">
        新增商家活动
      </el-button>
      <el-button @click="openCreate('domestic')">
        新增自定义节日
      </el-button>
    </PageHeader>

    <el-alert
      v-if="!collectionReady"
      class="collection-alert"
      type="warning"
      :closable="false"
      title="要保存节日与活动，请先在 CloudBase 数据库创建空集合 calendarEvents。"
    />

    <el-card shadow="never" class="panel-card">
      <div class="filter-bar event-filter-bar">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索节日、活动名称或说明"
        />

        <el-select v-model="filters.region" clearable placeholder="全部分类">
          <el-option label="国内节日" value="domestic" />
          <el-option label="国际节日" value="international" />
          <el-option label="商家活动" value="merchant" />
        </el-select>

        <el-select v-model="filters.status" clearable placeholder="全部状态">
          <el-option label="已启用" value="enabled" />
          <el-option label="已停用" value="disabled" />
        </el-select>

        <el-button :loading="loading" @click="loadData">刷新</el-button>
      </div>

      <el-table v-loading="loading" :data="filteredItems" row-key="eventKey">
        <el-table-column label="分类" width="110">
          <template #default="{ row }">
            <span :class="['region-badge', `is-${row.region}`]">
              {{ regionLabel(row.region) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="节日 / 活动" min-width="190">
          <template #default="{ row }">
            <div class="event-name-cell">
              <strong>{{ row.name }}</strong>
              <span>{{ sourceLabel(row) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="日期" min-width="200">
          <template #default="{ row }">{{ formatRule(row.rule) }}</template>
        </el-table-column>

        <el-table-column label="展示信息" min-width="270">
          <template #default="{ row }">
            <div class="event-copy-cell">
              <strong>{{ row.title || row.name }}</strong>
              <span v-if="row.activityTimeText">活动时间：{{ row.activityTimeText }}</span>
              <span>{{ row.description || '未配置说明' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="关联商品" width="100" align="center">
          <template #default="{ row }">{{ row.productIds?.length || 0 }}</template>
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
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="removeOrReset(row)">
              {{ row.builtIn ? '恢复默认' : '删除' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && !filteredItems.length"
        :image-size="64"
        description="没有匹配的节日或活动"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="780px"
      destroy-on-close
    >
      <el-form label-position="top">
        <div class="two-column">
          <el-form-item :label="form.region === 'merchant' ? '活动名称' : '节日名称'" required>
            <el-input v-model="form.name" :disabled="form.builtIn" />
          </el-form-item>

          <el-form-item label="类型" required>
            <el-select v-model="form.region" :disabled="form.builtIn">
              <el-option label="国内节日" value="domestic" />
              <el-option label="国际节日" value="international" />
              <el-option label="商家活动" value="merchant" />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item v-if="form.builtIn" label="日期规则">
          <el-input :model-value="formatRule(form.rule)" disabled />
        </el-form-item>

        <div v-else-if="form.region === 'merchant'" class="two-column">
          <el-form-item label="活动开始日期" required>
            <el-date-picker
              v-model="form.startDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择开始日期"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="活动结束日期" required>
            <el-date-picker
              v-model="form.endDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="单日活动可与开始日期相同"
              style="width: 100%"
            />
          </el-form-item>
        </div>

        <div v-else class="two-column">
          <el-form-item label="公历月份" required>
            <el-input-number v-model="form.month" :min="1" :max="12" controls-position="right" />
          </el-form-item>
          <el-form-item label="公历日期" required>
            <el-input-number v-model="form.day" :min="1" :max="31" controls-position="right" />
          </el-form-item>
        </div>

        <el-form-item :label="form.region === 'merchant' ? '活动标题' : '推荐标题'">
          <el-input
            v-model="form.title"
            :placeholder="form.region === 'merchant' ? '例如：七夕限定花礼预订' : '例如：送给妈妈的花'"
          />
        </el-form-item>

        <el-form-item v-if="form.region === 'merchant'" label="活动时间说明">
          <el-input
            v-model="form.activityTimeText"
            placeholder="例如：7月20日—7月31日，每日 09:00—22:00"
          />
        </el-form-item>

        <el-form-item :label="form.region === 'merchant' ? '活动详细信息' : '节日说明'">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            :placeholder="form.region === 'merchant' ? '填写活动内容、优惠条件、预约规则和注意事项' : '显示在小程序日历的简洁说明'"
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
            <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
          </el-form-item>
        </div>

        <el-form-item label="搜索关键词">
          <el-select
            v-model="form.searchKeywords"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入关键词后回车，例如：七夕、玫瑰、限定花礼"
          />
        </el-form-item>

        <el-form-item label="关联当前商品">
          <el-select
            v-model="form.productIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择活动或节日推荐商品"
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
              <strong>在日历中显示</strong>
              <span>关闭后顾客端不会显示该节日或活动</span>
            </div>
            <el-switch v-model="form.enabled" />
          </div>

          <div class="switch-row">
            <div>
              <strong>显示商品入口</strong>
              <span>开启后顾客可以从活动卡片进入关联花礼</span>
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
        >保存配置</el-button>
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

const filters = reactive({ keyword: '', region: '', status: '' })

const categoryOptions = [
  '推荐花束', '鲜花花束', '给自己', '生日祝福', '爱与纪念',
  '感谢心意', '探望慰问', '居家布置', '绿植多肉', '花器礼品'
]

function todayText() {
  const date = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const emptyForm = (region = 'domestic') => ({
  eventKey: '',
  builtIn: false,
  name: '',
  region,
  rule: null,
  month: 1,
  day: 1,
  startDate: todayText(),
  endDate: todayText(),
  title: '',
  activityTimeText: '',
  description: '',
  categoryIntent: '推荐花束',
  searchKeywords: [],
  productIds: [],
  recommendationEnabled: true,
  enabled: true,
  sort: region === 'merchant' ? 3000 : 100
})

const form = reactive(emptyForm())

const dialogTitle = computed(() => {
  if (form.builtIn) return '编辑内置节日配置'
  if (form.eventKey) return form.region === 'merchant' ? '编辑商家活动' : '编辑自定义节日'
  return form.region === 'merchant' ? '新增商家活动' : '新增自定义节日'
})

const filteredItems = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()
  return items.value.filter((item) => {
    if (keyword && ![
      item.name, item.title, item.description, item.activityTimeText,
      ...(item.searchKeywords || [])
    ].join(' ').toLowerCase().includes(keyword)) return false
    if (filters.region && item.region !== filters.region) return false
    if (filters.status === 'enabled' && item.enabled !== true) return false
    if (filters.status === 'disabled' && item.enabled === true) return false
    return true
  })
})

function regionLabel(region) {
  if (region === 'international') return '国际'
  if (region === 'merchant') return '活动'
  return '国内'
}

function sourceLabel(row) {
  if (row.region === 'merchant') return '商家活动日'
  return row.builtIn ? '内置真实节日' : '自定义节日'
}

function formatYuan(priceFen) {
  return (Number(priceFen || 0) / 100).toFixed(2)
}

function formatRule(rule) {
  if (!rule) return '未设置'
  if (rule.type === 'date') return rule.date || '未设置日期'
  if (rule.type === 'dateRange') {
    const start = rule.startDate || ''
    const end = rule.endDate || start
    return start === end ? start : `${start} 至 ${end}`
  }
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
  if (rule.type === 'solarTerm') return rule.term === 'qingming' ? '清明节气日' : '冬至节气日'
  return '自定义日期规则'
}

function resetForm(data = {}, region = 'domestic') {
  const next = { ...emptyForm(region), ...data }
  if (!next.builtIn && next.rule?.type === 'fixed') {
    next.month = Number(next.rule.month || 1)
    next.day = Number(next.rule.day || 1)
  }
  if (!next.builtIn && next.rule?.type === 'date') {
    next.startDate = next.rule.date || todayText()
    next.endDate = next.startDate
  }
  if (!next.builtIn && next.rule?.type === 'dateRange') {
    next.startDate = next.rule.startDate || todayText()
    next.endDate = next.rule.endDate || next.startDate
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
    feedback.error(error, '节日与活动加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate(region = 'domestic') {
  resetForm({}, region)
  dialogVisible.value = true
}

function openEdit(row) {
  resetForm(row, row.region || 'domestic')
  dialogVisible.value = true
}

async function save() {
  if (!form.name.trim()) {
    feedback.warning(form.region === 'merchant' ? '请输入活动名称' : '请输入节日名称')
    return
  }
  if (form.region === 'merchant') {
    if (!form.startDate || !form.endDate) {
      feedback.warning('请选择活动开始和结束日期')
      return
    }
    if (form.endDate < form.startDate) {
      feedback.warning('活动结束日期不能早于开始日期')
      return
    }
  }

  saving.value = true
  try {
    const rule = form.builtIn
      ? form.rule
      : form.region === 'merchant'
        ? (form.startDate === form.endDate
            ? { type: 'date', date: form.startDate }
            : { type: 'dateRange', startDate: form.startDate, endDate: form.endDate })
        : { type: 'fixed', month: Number(form.month), day: Number(form.day) }

    await adminApi.saveCalendarEvent({ ...form, rule })
    feedback.success(form.region === 'merchant' ? '商家活动已保存' : '节日配置已保存')
    dialogVisible.value = false
    await loadData()
  } catch (error) {
    feedback.error(error, '保存失败')
  } finally {
    saving.value = false
  }
}

async function removeOrReset(row) {
  const noun = row.region === 'merchant' ? '活动' : '节日'
  try {
    await ElMessageBox.confirm(
      row.builtIn
        ? `确定将“${row.name}”恢复为内置默认配置吗？`
        : `确定删除${noun}“${row.name}”吗？`,
      row.builtIn ? '恢复默认' : `删除${noun}`,
      {
        confirmButtonText: row.builtIn ? '恢复' : '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await adminApi.deleteCalendarEvent(row.eventKey)
    feedback.success(row.builtIn ? '已恢复默认配置' : `${noun}已删除`)
    await loadData()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') feedback.error(error, '操作失败')
  }
}

onMounted(loadData)
</script>

<style scoped>
.collection-alert { margin-bottom: 16px; }
.event-filter-bar .el-input { width: 300px; }
.region-badge {
  display: inline-flex;
  min-width: 52px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  font-size: 12px;
}
.region-badge.is-domestic { background: #faeeee; color: #b7555e; }
.region-badge.is-international { background: #eef2f8; color: #5873a5; }
.region-badge.is-merchant { background: #fff0d8; color: #a96d20; }
.event-name-cell strong,
.event-name-cell span,
.event-copy-cell strong,
.event-copy-cell span { display: block; }
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
.switch-list { border-top: 1px solid #ecefe9; }
.switch-row {
  display: flex;
  min-height: 66px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #ecefe9;
}
.switch-row strong,
.switch-row span { display: block; }
.switch-row span { margin-top: 4px; color: #8d928a; font-size: 12px; }
@media (max-width: 760px) {
  .two-column { grid-template-columns: minmax(0, 1fr); }
  .event-filter-bar .el-input { width: 100%; }
}
</style>
