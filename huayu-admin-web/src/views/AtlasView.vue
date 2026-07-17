<template>
  <div>
    <PageHeader
      title="花予图鉴"
      description="维护图鉴卡片、详情介绍、花期与养护内容。顾客可以收藏品种；存在有效购买记录时，小程序会显示“购买过”标记。"
    >
      <el-button type="primary" @click="openCreate">新增图鉴</el-button>
    </PageHeader>

    <el-alert
      title="收藏与购买记录相互独立"
      description="“收藏”由顾客主动操作；购买标记来自商品关联的图鉴品种和有效订单。请在商品编辑页维护商品包含的花材品种。"
      type="info"
      :closable="false"
      show-icon
      class="atlas-purchase-alert"
    />

    <el-card shadow="never" class="panel-card">
      <div class="filter-bar atlas-filter-bar">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索名称、别名、花语、花期或场景"
        />
        <el-select v-model="categoryFilter" placeholder="全部分类">
          <el-option label="全部分类" value="" />
          <el-option
            v-for="item in categoryOptions"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
        <el-select v-model="statusFilter" placeholder="全部状态">
          <el-option label="全部状态" value="" />
          <el-option label="已发布" value="published" />
          <el-option label="草稿" value="draft" />
          <el-option label="首页精选" value="home" />
        </el-select>
        <span class="atlas-filter-count">共 {{ filteredItems.length }} 条</span>
      </div>

      <el-table
        v-loading="loading"
        :data="filteredItems"
        row-key="_id"
        class="clean-table"
      >
        <el-table-column label="图鉴" min-width="300">
          <template #default="{ row }">
            <div class="atlas-table-cell">
              <div
                class="atlas-table-thumb"
                :class="`atlas-table-thumb--${row.imageBackground || 'soft'}`"
              >
                <el-image :src="row.imageUrl" fit="contain">
                  <template #error>
                    <div class="atlas-table-thumb__empty">花予</div>
                  </template>
                </el-image>
              </div>

              <div class="atlas-table-copy">
                <strong>{{ row.name }}</strong>
                <span>{{ row.atlasCode || '暂无图鉴编码' }} · {{ row.latinName || '暂无英文名' }}</span>
                <small>{{ row.floweringPeriod || seasonText(row) }}</small>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="description"
          label="介绍"
          min-width="230"
          show-overflow-tooltip
        />

        <el-table-column label="安全提示" min-width="180">
          <template #default="{ row }">
            <span :class="row.toxicityNote ? 'warning-text' : 'muted-text'">
              {{ row.toxicityNote || '无特别提示' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="首页" width="90" align="center">
          <template #default="{ row }">
            <StatusDot
              :text="row.homeFeatured ? '精选' : '否'"
              :type="row.homeFeatured ? 'success' : 'neutral'"
            />
          </template>
        </el-table-column>

        <el-table-column prop="sort" label="排序" width="80" align="right" />

        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <StatusDot
              :text="row.published ? '已发布' : '草稿'"
              :type="row.published ? 'success' : 'neutral'"
            />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="140" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && !filteredItems.length"
        :image-size="64"
        description="没有匹配的图鉴内容"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="form._id ? '编辑图鉴' : '新增图鉴'"
      width="880px"
      destroy-on-close
      class="atlas-dialog"
    >
      <div class="atlas-edit-layout">
        <el-form label-position="top" class="atlas-edit-form">
          <div class="form-grid form-grid--three">
            <el-form-item label="图鉴编码">
              <el-input v-model="form.atlasCode" placeholder="例如 ATL-GLORIOSA；留空由系统生成" />
            </el-form-item>
            <el-form-item label="中文名称">
              <el-input v-model="form.name" placeholder="例如 嘉兰" />
            </el-form-item>
            <el-form-item label="英文名或拉丁名">
              <el-input v-model="form.latinName" placeholder="例如 Gloriosa" />
            </el-form-item>
          </div>

          <div class="form-grid form-grid--two">
            <el-form-item label="别名">
              <el-input v-model="form.alias" placeholder="例如 火焰百合" />
            </el-form-item>
            <el-form-item label="花语">
              <el-input v-model="form.meaning" placeholder="例如 热情" />
            </el-form-item>
          </div>

          <div class="form-grid form-grid--two">
            <el-form-item label="图鉴分类">
              <el-select
                v-model="form.category"
                filterable
                allow-create
                default-first-option
              >
                <el-option
                  v-for="item in categoryOptions"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="花期文字">
              <el-input
                v-model="form.floweringPeriod"
                placeholder="例如 7–8月 / July–August"
              />
            </el-form-item>
          </div>

          <el-form-item label="花材介绍">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="5"
              placeholder="介绍名称来源、花型、色彩、特点与适用方式"
            />
          </el-form-item>

          <el-form-item label="养护说明">
            <el-input
              v-model="form.careGuide"
              type="textarea"
              :rows="4"
              placeholder="每条建议可用换行或分号分隔"
            />
          </el-form-item>

          <el-form-item label="安全提示">
            <el-input
              v-model="form.toxicityNote"
              type="textarea"
              :rows="3"
              placeholder="例如：全株含秋水仙碱，应避免儿童或宠物误食。没有特别风险时可留空。"
            />
          </el-form-item>

          <div class="form-grid form-grid--two">
            <el-form-item label="适用场景">
              <el-select
                v-model="form.sceneTags"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入场景"
              >
                <el-option
                  v-for="tag in sceneOptions"
                  :key="tag"
                  :label="tag"
                  :value="tag"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="颜色标签">
              <el-select
                v-model="form.colorTags"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入颜色"
              >
                <el-option
                  v-for="tag in colorOptions"
                  :key="tag"
                  :label="tag"
                  :value="tag"
                />
              </el-select>
            </el-form-item>
          </div>

          <div class="form-grid form-grid--two">
            <el-form-item label="季节标签">
              <el-select
                v-model="form.seasonTags"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="例如 夏季、全年"
              >
                <el-option
                  v-for="tag in seasonOptions"
                  :key="tag"
                  :label="tag"
                  :value="tag"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="图片背景">
              <el-select v-model="form.imageBackground">
                <el-option label="柔和浅灰" value="soft" />
                <el-option label="深色背景" value="dark" />
                <el-option label="纯白背景" value="light" />
              </el-select>
            </el-form-item>
          </div>

          <div class="form-grid form-grid--three">
            <el-form-item label="排序值">
              <el-input-number
                v-model="form.sort"
                :min="0"
                controls-position="right"
              />
            </el-form-item>
            <el-form-item label="首页精选">
              <el-switch v-model="form.homeFeatured" />
            </el-form-item>
            <el-form-item label="发布状态">
              <el-switch v-model="form.published" />
            </el-form-item>
          </div>

          <el-form-item label="图鉴图片" class="atlas-image-field">
            <ImageUploader
              v-model="form.imageFileId"
              v-model:preview-url="form.imageUrl"
              folder="atlas"
            />
          </el-form-item>
        </el-form>

        <aside class="atlas-preview">
          <span class="atlas-preview__label">小程序详情预览</span>

          <div
            class="atlas-preview__image"
            :class="`atlas-preview__image--${form.imageBackground}`"
          >
            <img v-if="form.imageUrl" :src="form.imageUrl" alt="" />
            <span v-else>花予</span>
          </div>

          <strong>{{ editorialTitle(form) || '花语 · 花材名称' }}</strong>
          <p>{{ form.description || '在这里展示花材介绍、名称来源与特点。' }}</p>
          <small>[ 花期：{{ form.floweringPeriod || seasonText(form) }} ]</small>

          <div v-if="form.toxicityNote" class="atlas-preview__warning">
            {{ form.toxicityNote }}
          </div>
        </aside>
      </div>

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
  atlasCode: '',
  name: '',
  latinName: '',
  alias: '',
  meaning: '',
  description: '',
  careGuide: '',
  floweringPeriod: '',
  toxicityNote: '',
  imageBackground: 'soft',
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
      row.atlasCode,
      row.name,
      row.latinName,
      row.alias,
      row.meaning,
      row.description,
      row.floweringPeriod,
      row.toxicityNote,
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

function seasonText(row) {
  const tags = Array.isArray(row.seasonTags)
    ? row.seasonTags.filter(Boolean)
    : []

  return tags.length ? tags.join(' / ') : '待完善'
}

function editorialTitle(row) {
  return [
    row.meaning,
    row.name
  ].filter(Boolean).join(' · ')
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
    seasonTags: [...(data.seasonTags || [])],
    imageBackground: data.imageBackground || 'soft'
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
    await ElMessageBox.confirm(
      `确定删除“${item.name}”吗？`,
      '删除图鉴',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

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

<style scoped>
.atlas-table-cell {
  display: flex;
  min-width: 0;
  align-items: center;
}

.atlas-table-thumb {
  display: flex;
  width: 74px;
  height: 74px;
  flex: 0 0 74px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid #e5e8e1;
  border-radius: 8px;
}

.atlas-table-thumb--dark,
.atlas-preview__image--dark {
  background: #090a09;
}

.atlas-table-thumb--light,
.atlas-preview__image--light {
  background: #ffffff;
}

.atlas-table-thumb--soft,
.atlas-preview__image--soft {
  background: #eef1eb;
}

.atlas-table-thumb :deep(.el-image),
.atlas-table-thumb :deep(img) {
  width: 100%;
  height: 100%;
}

.atlas-table-thumb__empty {
  color: #66754f;
  font-size: 13px;
}

.atlas-table-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  margin-left: 12px;
}

.atlas-table-copy strong,
.atlas-table-copy span,
.atlas-table-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atlas-table-copy strong {
  color: #2c3329;
}

.atlas-table-copy span {
  margin-top: 4px;
  color: #929a8f;
  font-size: 12px;
}

.atlas-table-copy small {
  margin-top: 5px;
  color: #69745e;
  font-size: 12px;
}

.warning-text {
  color: #9b654d;
}

.muted-text {
  color: #a0a69d;
}

.atlas-edit-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 22px;
}

.atlas-edit-form {
  min-width: 0;
}

.atlas-preview {
  position: sticky;
  top: 0;
  align-self: start;
  padding: 16px;
  border: 1px solid #e3e7df;
  border-radius: 12px;
  background: #fbfbf8;
}

.atlas-preview__label {
  display: block;
  margin-bottom: 12px;
  color: #8b9388;
  font-size: 12px;
  letter-spacing: 1px;
}

.atlas-preview__image {
  display: flex;
  width: 100%;
  height: 220px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid #e3e7df;
}

.atlas-preview__image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.atlas-preview__image span {
  color: #66754f;
  font-weight: 700;
}

.atlas-preview strong {
  display: block;
  margin-top: 16px;
  color: #252a24;
  font-size: 18px;
  line-height: 1.5;
}

.atlas-preview p {
  margin: 16px 0 0;
  color: #4f554c;
  font-size: 14px;
  line-height: 1.8;
}

.atlas-preview small {
  display: block;
  margin-top: 18px;
  color: #4f554c;
}

.atlas-preview__warning {
  margin-top: 16px;
  padding: 10px;
  border-radius: 8px;
  background: #faf1eb;
  color: #8a604b;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 980px) {
  .atlas-edit-layout {
    grid-template-columns: 1fr;
  }

  .atlas-preview {
    position: static;
  }
}
</style>
