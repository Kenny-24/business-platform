<template>
  <div>
    <PageHeader
      title="花予图鉴"
      description="维护图鉴卡片、详情介绍和养护内容。已发布品种进入“全部”；顾客购买关联商品后自动进入“我的”。"
    >
      <el-button type="primary" @click="openCreate">新增图鉴</el-button>
    </PageHeader>

    <el-alert
      title="“我的图鉴”来自购买记录，不是收藏夹"
      description="请先在商品编辑页关联图鉴品种。顾客的有效订单包含该商品后，品种会自动收录到小程序“我的图鉴”。"
      type="info"
      :closable="false"
      show-icon
      class="atlas-purchase-alert"
    />

    <el-card shadow="never" class="panel-card">
      <div class="filter-bar atlas-filter-bar">
        <el-input v-model="keyword" clearable placeholder="搜索名称、花语或场景" />
        <el-select v-model="categoryFilter" placeholder="全部分类">
          <el-option label="全部分类" value="" />
          <el-option v-for="item in categoryOptions" :key="item" :label="item" :value="item" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="全部状态">
          <el-option label="全部状态" value="" />
          <el-option label="已发布" value="published" />
          <el-option label="草稿" value="draft" />
          <el-option label="首页精选" value="home" />
        </el-select>
        <span class="atlas-filter-count">共 {{ filteredItems.length }} 条</span>
      </div>

      <el-table v-loading="loading" :data="filteredItems" row-key="_id" class="clean-table">
        <el-table-column label="图鉴" min-width="270">
          <template #default="{ row }">
            <div class="product-cell">
              <el-image class="table-thumb" :src="row.imageUrl" fit="cover">
                <template #error><div class="table-thumb__empty">无图</div></template>
              </el-image>
              <div class="product-cell__text">
                <strong>{{ row.name }}</strong>
                <span>{{ row.latinName || '暂无英文名' }} · {{ row.category || '鲜切花' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="meaning" label="花语" min-width="200" show-overflow-tooltip />

        <el-table-column label="标签" min-width="220">
          <template #default="{ row }">
            <span class="tag-text">{{ tagSummary(row) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="首页" width="90" align="center">
          <template #default="{ row }">
            <StatusDot :text="row.homeFeatured ? '精选' : '否'" :type="row.homeFeatured ? 'success' : 'neutral'" />
          </template>
        </el-table-column>

        <el-table-column prop="sort" label="排序" width="80" align="right" />

        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <StatusDot :text="row.published ? '已发布' : '草稿'" :type="row.published ? 'success' : 'neutral'" />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="140" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && !filteredItems.length" :image-size="64" description="没有匹配的图鉴内容" />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form._id ? '编辑图鉴' : '新增图鉴'" width="760px" destroy-on-close>
      <el-form label-position="top">
        <div class="form-grid form-grid--two">
          <el-form-item label="中文名称">
            <el-input v-model="form.name" placeholder="例如 玫瑰" />
          </el-form-item>
          <el-form-item label="英文名或拉丁名">
            <el-input v-model="form.latinName" placeholder="例如 Rosa" />
          </el-form-item>
        </div>

        <div class="form-grid form-grid--two">
          <el-form-item label="图鉴分类">
            <el-select v-model="form.category" filterable allow-create default-first-option>
              <el-option v-for="item in categoryOptions" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="花语">
            <el-input v-model="form.meaning" placeholder="例如 温柔与偏爱" />
          </el-form-item>
        </div>

        <el-form-item label="花材介绍">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="介绍花材特点和适用场景" />
        </el-form-item>

        <el-form-item label="养护说明">
          <el-input v-model="form.careGuide" type="textarea" :rows="3" placeholder="填写修剪、换水和摆放建议" />
        </el-form-item>

        <div class="form-grid form-grid--two">
          <el-form-item label="适用场景">
            <el-select v-model="form.sceneTags" multiple filterable allow-create default-first-option placeholder="选择或输入场景">
              <el-option v-for="tag in sceneOptions" :key="tag" :label="tag" :value="tag" />
            </el-select>
          </el-form-item>
          <el-form-item label="颜色标签">
            <el-select v-model="form.colorTags" multiple filterable allow-create default-first-option placeholder="选择或输入颜色">
              <el-option v-for="tag in colorOptions" :key="tag" :label="tag" :value="tag" />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="花期 / 季节">
          <el-select v-model="form.seasonTags" multiple filterable allow-create default-first-option placeholder="例如 春季、全年">
            <el-option v-for="tag in seasonOptions" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </el-form-item>

        <div class="form-grid form-grid--three">
          <el-form-item label="排序值">
            <el-input-number v-model="form.sort" :min="0" controls-position="right" />
          </el-form-item>
          <el-form-item label="首页精选">
            <el-switch v-model="form.homeFeatured" />
          </el-form-item>
          <el-form-item label="发布状态">
            <el-switch v-model="form.published" />
          </el-form-item>
        </div>

        <el-alert title="首页按“首页精选 → 排序值”展示前 3 条；详情页展示花语、花材介绍、养护说明和标签。购买收录关系在商品编辑页配置。" type="info" :closable="false" show-icon />

        <el-form-item label="图鉴图片" class="atlas-image-field">
          <ImageUploader v-model="form.imageFileId" v-model:preview-url="form.imageUrl" folder="atlas" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import PageHeader from '../components/PageHeader.vue'
import ImageUploader from '../components/ImageUploader.vue'
import StatusDot from '../components/StatusDot.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const loading = ref(false)
const saving = ref(false)
const items = ref([])
const dialogVisible = ref(false)
const keyword = ref('')
const categoryFilter = ref('')
const statusFilter = ref('')

const categoryOptions = ['鲜切花', '叶材', '枝材', '果实', '干花', '盆栽', '其他']
const sceneOptions = ['自我取悦', '节日送礼', '生日纪念', '家居软装', '办公空间', '乔迁开业']
const colorOptions = ['粉色', '白色', '红色', '紫色', '黄色', '绿色', '香槟色', '奶油色', '混色']
const seasonOptions = ['春季', '夏季', '秋季', '冬季', '全年']

const emptyForm = () => ({
  _id: '',
  name: '',
  latinName: '',
  meaning: '',
  description: '',
  careGuide: '',
  category: '鲜切花',
  sceneTags: [],
  colorTags: [],
  seasonTags: [],
  imageFileId: '',
  imageUrl: '',
  homeFeatured: false,
  published: true,
  sort: 100
})

const form = reactive(emptyForm())

const filteredItems = computed(() => {
  const query = keyword.value.trim().toLowerCase()

  return items.value.filter((row) => {
    const source = [
      row.name,
      row.latinName,
      row.meaning,
      row.description,
      row.category,
      ...(row.sceneTags || []),
      ...(row.colorTags || []),
      ...(row.seasonTags || [])
    ].filter(Boolean).join(' ').toLowerCase()

    if (query && !source.includes(query)) return false
    if (categoryFilter.value && row.category !== categoryFilter.value) return false
    if (statusFilter.value === 'published' && row.published !== true) return false
    if (statusFilter.value === 'draft' && row.published === true) return false
    if (statusFilter.value === 'home' && row.homeFeatured !== true) return false
    return true
  })
})

function tagSummary(row) {
  const tags = [
    ...(row.colorTags || []),
    ...(row.seasonTags || []),
    ...(row.sceneTags || [])
  ]
  return tags.length ? tags.slice(0, 4).join('、') : '—'
}

async function loadItems() {
  loading.value = true
  try {
    const result = await adminApi.listAtlas()
    items.value = result.items || []
  } catch (error) {
    feedback.error(error, '图鉴数据加载失败')
  } finally {
    loading.value = false
  }
}

function resetForm(data = {}) {
  Object.assign(form, emptyForm(), data, {
    sceneTags: [...(data.sceneTags || [])],
    colorTags: [...(data.colorTags || [])],
    seasonTags: [...(data.seasonTags || [])]
  })
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(item) {
  resetForm(item)
  dialogVisible.value = true
}

async function save() {
  if (!form.name.trim()) {
    feedback.warning('请输入花材名称')
    return
  }

  saving.value = true
  try {
    await adminApi.saveAtlas({ ...form })
    feedback.success('图鉴内容已保存')
    dialogVisible.value = false
    await loadItems()
  } catch (error) {
    feedback.error(error, '保存图鉴失败')
  } finally {
    saving.value = false
  }
}

async function remove(item) {
  try {
    await ElMessageBox.confirm(`确定删除“${item.name}”吗？`, '删除图鉴', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminApi.deleteAtlas(item._id)
    feedback.success('图鉴已删除')
    await loadItems()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      feedback.error(error, '删除图鉴失败')
    }
  }
}

onMounted(loadItems)
</script>
