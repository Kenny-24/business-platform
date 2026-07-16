<template>
  <div>
    <PageHeader
      title="首页轮播"
      description="管理小程序首页轮播图片和文案。"
    >
      <el-button
        type="primary"
        @click="openCreate"
      >
        新增轮播
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
          width="130"
        >
          <template #default="{ row }">
            <el-image
              class="banner-thumb"
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
          label="内容"
          min-width="300"
        >
          <template #default="{ row }">
            <div class="content-cell">
              <strong>{{ row.title }}</strong>
              <span>
                {{ row.subtitle || '暂无副标题' }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="scene"
          label="场景"
          width="120"
        />

        <el-table-column
          prop="buttonText"
          label="按钮"
          width="130"
        />

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
                row.enabled
                  ? '已启用'
                  : '已停用'
              "
              :type="
                row.enabled
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
        description="还没有轮播内容"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="
        form._id
          ? '编辑轮播'
          : '新增轮播'
      "
      width="680px"
      destroy-on-close
    >
      <el-form label-position="top">
        <div class="form-grid form-grid--two">
          <el-form-item label="场景名称">
            <el-input
              v-model="form.scene"
              placeholder="例如 自我取悦"
            />
          </el-form-item>

          <el-form-item label="按钮文字">
            <el-input
              v-model="form.buttonText"
              placeholder="例如 立即查看"
            />
          </el-form-item>
        </div>

        <el-form-item label="主标题">
          <el-input
            v-model="form.title"
            placeholder="请输入主标题"
          />
        </el-form-item>

        <el-form-item label="副标题">
          <el-input
            v-model="form.subtitle"
            placeholder="请输入副标题"
          />
        </el-form-item>

        <div class="form-grid form-grid--two">
          <el-form-item label="跳转类型">
            <el-select
              v-model="form.actionType"
            >
              <el-option
                label="商品分类"
                value="category"
              />
              <el-option
                label="日历页面"
                value="calendar"
              />
              <el-option
                label="自由搭配"
                value="builder"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="跳转值">
            <el-input
              v-model="form.actionValue"
              placeholder="例如 flower"
            />
          </el-form-item>
        </div>

        <div class="form-grid form-grid--two">
          <el-form-item label="排序值">
            <el-input-number
              v-model="form.sort"
              :min="0"
              controls-position="right"
            />
          </el-form-item>

          <el-form-item label="是否启用">
            <el-switch
              v-model="form.enabled"
            />
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
    const result =
      await adminApi.listBanners()

    items.value = result.items || []
  } catch (error) {
    feedback.error(
      error,
      '轮播数据加载失败'
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

function openEdit(row) {
  resetForm(row)
  dialogVisible.value = true
}

async function save() {
  if (!form.title.trim()) {
    feedback.warning('请输入主标题')
    return
  }

  saving.value = true

  try {
    await adminApi.saveBanner({
      ...form
    })

    feedback.success('轮播内容已保存')
    dialogVisible.value = false
    loadItems()
  } catch (error) {
    feedback.error(
      error,
      '保存轮播失败'
    )
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除“${row.title}”吗？`,
      '删除轮播',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await adminApi.deleteBanner(
      row._id
    )

    feedback.success('轮播已删除')
    loadItems()
  } catch (error) {
    if (
      error !== 'cancel' &&
      error !== 'close'
    ) {
      feedback.error(
        error,
        '删除轮播失败'
      )
    }
  }
}

onMounted(loadItems)
</script>
