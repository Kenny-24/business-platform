<template>
  <div>
    <PageHeader
      title="首页轮播"
      description="管理小程序首屏的场景、文案、图片和排序。"
    >
      <el-button type="primary" @click="openCreate">
        新增轮播
      </el-button>
    </PageHeader>

    <el-card shadow="never" class="panel-card">
      <el-table
        v-loading="loading"
        :data="items"
        row-key="_id"
      >
        <el-table-column label="图片" width="140">
          <template #default="{ row }">
            <el-image
              class="banner-thumb"
              :src="row.imageUrl"
              fit="cover"
            >
              <template #error>
                <div class="image-fallback">花予</div>
              </template>
            </el-image>
          </template>
        </el-table-column>

        <el-table-column label="场景与文案" min-width="320">
          <template #default="{ row }">
            <div class="text-stack">
              <small>{{ row.scene }}</small>
              <strong>{{ row.title }}</strong>
              <span>{{ row.subtitle }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="buttonText" label="按钮" width="150" />
        <el-table-column prop="sort" label="排序" width="80" />

        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-tag
              :type="row.enabled ? 'success' : 'info'"
              effect="plain"
            >
              {{ row.enabled ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="170">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button link type="danger" @click="remove(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && !items.length"
        description="还没有轮播内容"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="form._id ? '编辑轮播' : '新增轮播'"
      width="720px"
      destroy-on-close
    >
      <el-form label-position="top">
        <div class="two-column">
          <el-form-item label="场景名称">
            <el-input v-model="form.scene" placeholder="自我取悦" />
          </el-form-item>
          <el-form-item label="按钮文字">
            <el-input v-model="form.buttonText" placeholder="为自己选花" />
          </el-form-item>
        </div>

        <el-form-item label="主标题">
          <el-input v-model="form.title" placeholder="给自己，一束日常" />
        </el-form-item>

        <el-form-item label="副标题">
          <el-input v-model="form.subtitle" placeholder="不为节日，只为此刻喜欢" />
        </el-form-item>

        <div class="two-column">
          <el-form-item label="跳转类型">
            <el-select v-model="form.actionType">
              <el-option label="商品分类" value="category" />
              <el-option label="日历页面" value="calendar" />
              <el-option label="自由搭配" value="builder" />
            </el-select>
          </el-form-item>

          <el-form-item label="跳转值">
            <el-input v-model="form.actionValue" placeholder="flower" />
          </el-form-item>
        </div>

        <div class="two-column">
          <el-form-item label="排序值">
            <el-input-number
              v-model="form.sort"
              :min="0"
              controls-position="right"
            />
          </el-form-item>

          <el-form-item label="是否启用">
            <el-switch v-model="form.enabled" />
          </el-form-item>
        </div>

        <el-form-item label="轮播图片">
          <ImageUploader
            v-model="form.imageFileId"
            v-model:preview-url="form.imageUrl"
            folder="banners"
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

const emptyForm = () => ({
  _id: '',
  scene: '',
  title: '',
  subtitle: '',
  buttonText: '',
  imageFileId: '',
  imageUrl: '',
  actionType: 'category',
  actionValue: 'flower',
  enabled: true,
  sort: 100
})

const form = reactive(emptyForm())

async function loadItems() {
  loading.value = true
  try {
    const result = await adminApi.listBanners()
    items.value = result.items || []
  } catch (error) {
    ElMessage.error(error.message || '轮播数据加载失败')
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

function openEdit(row) {
  resetForm(row)
  dialogVisible.value = true
}

async function save() {
  if (!form.title.trim()) {
    ElMessage.warning('请输入主标题')
    return
  }

  saving.value = true
  try {
    await adminApi.saveBanner({ ...form })
    ElMessage.success('轮播内容已保存')
    dialogVisible.value = false
    loadItems()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  await ElMessageBox.confirm(
    `确定删除轮播“${row.title}”吗？`,
    '删除轮播',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )

  try {
    await adminApi.deleteBanner(row._id)
    ElMessage.success('轮播已删除')
    loadItems()
  } catch (error) {
    ElMessage.error(error.message || '删除失败')
  }
}

onMounted(loadItems)
</script>
