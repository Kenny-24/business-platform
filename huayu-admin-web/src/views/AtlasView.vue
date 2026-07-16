<template>
  <div>
    <PageHeader
      title="花予图鉴"
      description="管理花材介绍、花语和养护说明。"
    >
      <el-button
        type="primary"
        @click="openCreate"
      >
        新增图鉴
      </el-button>
    </PageHeader>

    <el-card
      shadow="never"
      class="panel-card"
    >
      <el-table
        v-loading="loading"
        :data="items"
        row-key="_id"
        class="clean-table"
      >
        <el-table-column
          label="图片"
          width="90"
        >
          <template #default="{ row }">
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
          </template>
        </el-table-column>

        <el-table-column
          label="花材"
          min-width="220"
        >
          <template #default="{ row }">
            <div class="content-cell">
              <strong>{{ row.name }}</strong>
              <span>
                {{ row.latinName || '暂无英文名' }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="meaning"
          label="花语"
          min-width="220"
          show-overflow-tooltip
        />

        <el-table-column
          label="场景"
          min-width="180"
        >
          <template #default="{ row }">
            <span class="tag-text">
              {{
                row.sceneTags?.join('、') ||
                '—'
              }}
            </span>
          </template>
        </el-table-column>

        <el-table-column
          prop="sort"
          label="排序"
          width="80"
          align="right"
        />

        <el-table-column
          label="状态"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <StatusDot
              :text="
                row.published
                  ? '已发布'
                  : '草稿'
              "
              :type="
                row.published
                  ? 'success'
                  : 'neutral'
              "
            />
          </template>
        </el-table-column>

        <el-table-column
          label="操作"
          width="140"
          align="right"
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="openEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              link
              type="danger"
              @click="remove(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && !items.length"
        :image-size="64"
        description="还没有图鉴内容"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="
        form._id
          ? '编辑图鉴'
          : '新增图鉴'
      "
      width="720px"
      destroy-on-close
    >
      <el-form label-position="top">
        <div class="form-grid form-grid--two">
          <el-form-item label="中文名称">
            <el-input
              v-model="form.name"
              placeholder="例如 玫瑰"
            />
          </el-form-item>

          <el-form-item label="英文名或拉丁名">
            <el-input
              v-model="form.latinName"
              placeholder="例如 Rosa"
            />
          </el-form-item>
        </div>

        <el-form-item label="花语">
          <el-input
            v-model="form.meaning"
            placeholder="请输入花语"
          />
        </el-form-item>

        <el-form-item label="花材介绍">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="介绍花材特点和适用场景"
          />
        </el-form-item>

        <el-form-item label="养护说明">
          <el-input
            v-model="form.careGuide"
            type="textarea"
            :rows="3"
            placeholder="填写修剪、换水和摆放建议"
          />
        </el-form-item>

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

        <div class="form-grid form-grid--two">
          <el-form-item label="排序值">
            <el-input-number
              v-model="form.sort"
              :min="0"
              controls-position="right"
            />
          </el-form-item>

          <el-form-item label="发布状态">
            <el-switch
              v-model="form.published"
            />
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
        <el-button
          @click="dialogVisible = false"
        >
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
import {
  onMounted,
  reactive,
  ref
} from 'vue'
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
    const result =
      await adminApi.listAtlas()

    items.value = result.items || []
  } catch (error) {
    feedback.error(
      error,
      '图鉴数据加载失败'
    )
  } finally {
    loading.value = false
  }
}

function resetForm(data = {}) {
  Object.assign(
    form,
    emptyForm(),
    data
  )
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
    await adminApi.saveAtlas({
      ...form
    })

    feedback.success('图鉴内容已保存')
    dialogVisible.value = false
    loadItems()
  } catch (error) {
    feedback.error(
      error,
      '保存图鉴失败'
    )
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

    await adminApi.deleteAtlas(
      item._id
    )

    feedback.success('图鉴已删除')
    loadItems()
  } catch (error) {
    if (
      error !== 'cancel' &&
      error !== 'close'
    ) {
      feedback.error(
        error,
        '删除图鉴失败'
      )
    }
  }
}

onMounted(loadItems)
</script>
