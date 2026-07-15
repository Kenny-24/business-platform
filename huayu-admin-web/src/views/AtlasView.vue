<template>
  <div>
    <PageHeader
      title="花予图鉴"
      description="维护花材名称、拉丁名、花语、养护知识与图片。"
    >
      <el-button type="primary" @click="openCreate">
        新增图鉴
      </el-button>
    </PageHeader>

    <div v-loading="loading" class="atlas-admin-grid">
      <article
        v-for="item in items"
        :key="item._id"
        class="atlas-admin-card"
      >
        <el-image
          class="atlas-admin-card__image"
          :src="item.imageUrl"
          fit="cover"
        >
          <template #error>
            <div class="image-fallback">花予</div>
          </template>
        </el-image>

        <div class="atlas-admin-card__body">
          <small>{{ item.latinName || 'BOTANICAL NOTE' }}</small>
          <h3>{{ item.name }}</h3>
          <p>{{ item.meaning || '暂无花语说明' }}</p>

          <div class="atlas-admin-card__meta">
            <el-tag
              :type="item.published ? 'success' : 'info'"
              effect="plain"
            >
              {{ item.published ? '已发布' : '草稿' }}
            </el-tag>
            <span>排序 {{ item.sort }}</span>
          </div>

          <div class="atlas-admin-card__actions">
            <el-button link type="primary" @click="openEdit(item)">
              编辑
            </el-button>
            <el-button link type="danger" @click="remove(item)">
              删除
            </el-button>
          </div>
        </div>
      </article>

      <el-empty
        v-if="!loading && !items.length"
        description="还没有图鉴内容"
      />
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="form._id ? '编辑图鉴' : '新增图鉴'"
      width="760px"
      destroy-on-close
    >
      <el-form label-position="top">
        <div class="two-column">
          <el-form-item label="中文名称">
            <el-input v-model="form.name" placeholder="玫瑰" />
          </el-form-item>

          <el-form-item label="拉丁名 / 英文名">
            <el-input v-model="form.latinName" placeholder="Rosa" />
          </el-form-item>
        </div>

        <el-form-item label="花语">
          <el-input v-model="form.meaning" placeholder="温柔与偏爱" />
        </el-form-item>

        <el-form-item label="花材介绍">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="介绍花材特点、花期和适用场景"
          />
        </el-form-item>

        <el-form-item label="养护说明">
          <el-input
            v-model="form.careGuide"
            type="textarea"
            :rows="3"
            placeholder="修剪、换水、温度和摆放建议"
          />
        </el-form-item>

        <el-form-item label="适用场景">
          <el-select
            v-model="form.sceneTags"
            multiple
            filterable
            allow-create
            default-first-option
          >
            <el-option
              v-for="tag in sceneOptions"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
        </el-form-item>

        <div class="two-column">
          <el-form-item label="排序值">
            <el-input-number
              v-model="form.sort"
              :min="0"
              controls-position="right"
            />
          </el-form-item>

          <el-form-item label="发布状态">
            <el-switch v-model="form.published" />
          </el-form-item>
        </div>

        <el-form-item label="图鉴图片">
          <ImageUploader
            v-model="form.imageFileId"
            v-model:preview-url="form.imageUrl"
            folder="atlas"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="save"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import PageHeader from '../components/PageHeader.vue'
import ImageUploader from '../components/ImageUploader.vue'
import { adminApi } from '../services/admin'

const loading = ref(false)
const saving = ref(false)
const items = ref([])
const dialogVisible = ref(false)

const sceneOptions = [
  '自我取悦',
  '节日送礼',
  '生日纪念',
  '家居软装',
  '办公空间',
  '乔迁开业'
]

const emptyForm = () => ({
  _id: '',
  name: '',
  latinName: '',
  meaning: '',
  description: '',
  careGuide: '',
  sceneTags: [],
  imageFileId: '',
  imageUrl: '',
  published: true,
  sort: 100
})

const form = reactive(emptyForm())

async function loadItems() {
  loading.value = true
  try {
    const result = await adminApi.listAtlas()
    items.value = result.items || []
  } catch (error) {
    ElMessage.error(error.message || '图鉴数据加载失败')
  } finally {
    loading.value = false
  }
}

function resetForm(data = {}) {
  Object.assign(form, emptyForm(), data)
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
    ElMessage.warning('请输入花材名称')
    return
  }

  saving.value = true
  try {
    await adminApi.saveAtlas({ ...form })
    ElMessage.success('图鉴内容已保存')
    dialogVisible.value = false
    loadItems()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(item) {
  await ElMessageBox.confirm(
    `确定删除图鉴“${item.name}”吗？`,
    '删除图鉴',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )

  try {
    await adminApi.deleteAtlas(item._id)
    ElMessage.success('图鉴已删除')
    loadItems()
  } catch (error) {
    ElMessage.error(error.message || '删除失败')
  }
}

onMounted(loadItems)
</script>
