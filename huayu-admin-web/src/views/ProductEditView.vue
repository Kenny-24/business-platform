<template>
  <div>
    <PageHeader
      :title="isEdit ? '编辑商品' : '新增商品'"
      description="顾客端所需字段会由后台自动转换并写入数据库。"
    >
      <el-button @click="router.back()">
        返回列表
      </el-button>
      <el-button
        type="primary"
        :loading="saving"
        @click="save"
      >
        保存商品
      </el-button>
    </PageHeader>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="editor-grid"
    >
      <el-card shadow="never" class="panel-card editor-main">
        <h2 class="form-section-title">基本信息</h2>

        <div class="two-column">
          <el-form-item label="商品名称" prop="name">
            <el-input
              v-model="form.name"
              placeholder="例如 香槟玫瑰"
            />
          </el-form-item>

          <el-form-item label="商品类型" prop="type">
            <el-select v-model="form.type">
              <el-option
                v-for="option in typeOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="商品副标题">
          <el-input
            v-model="form.subtitle"
            placeholder="例如 温柔优雅"
          />
        </el-form-item>

        <div class="three-column">
          <el-form-item label="价格（元）" prop="priceYuan">
            <el-input-number
              v-model="form.priceYuan"
              :min="0"
              :precision="2"
              :step="1"
              controls-position="right"
            />
          </el-form-item>

          <el-form-item label="销售单位" prop="unit">
            <el-input
              v-model="form.unit"
              placeholder="枝 / 束 / 盆"
            />
          </el-form-item>

          <el-form-item label="库存" prop="stock">
            <el-input-number
              v-model="form.stock"
              :min="0"
              :step="1"
              controls-position="right"
            />
          </el-form-item>
        </div>

        <div class="two-column">
          <el-form-item label="使用场景">
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

        <h2 class="form-section-title form-section-title--spaced">
          销售设置
        </h2>

        <div class="settings-row">
          <div>
            <strong>商品上架</strong>
            <span>开启后顾客端可以看到并购买</span>
          </div>
          <el-switch v-model="form.onSale" />
        </div>

        <div class="settings-row">
          <div>
            <strong>首页推荐</strong>
            <span>在“今日有花”或推荐内容中优先展示</span>
          </div>
          <el-switch v-model="form.featured" />
        </div>

        <el-form-item label="排序值">
          <el-input-number
            v-model="form.sort"
            :min="0"
            :max="9999"
            controls-position="right"
          />
          <p class="field-hint">数字越大，排序越靠前。</p>
        </el-form-item>
      </el-card>

      <el-card shadow="never" class="panel-card editor-side">
        <h2 class="form-section-title">商品图片</h2>

        <ImageUploader
          v-model="form.coverFileId"
          v-model:preview-url="form.imageUrl"
          folder="products"
        />

        <div class="image-guidance">
          <strong>图片建议</strong>
          <p>推荐比例 1:1 或 4:5，主体居中、背景干净。</p>
          <p>图片上传后会保存永久 File ID，顾客端通过云函数获取临时地址。</p>
        </div>
      </el-card>
    </el-form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import PageHeader from '../components/PageHeader.vue'
import ImageUploader from '../components/ImageUploader.vue'
import { adminApi } from '../services/admin'

const route = useRoute()
const router = useRouter()
const formRef = ref()
const saving = ref(false)

const isEdit = computed(() => Boolean(route.params.id))

const form = reactive({
  _id: '',
  type: 'flower',
  name: '',
  subtitle: '',
  priceYuan: 0,
  unit: '枝',
  stock: 0,
  onSale: true,
  featured: false,
  sceneTags: [],
  colorTags: [],
  coverFileId: '',
  imageUrl: '',
  sort: 100
})

const typeOptions = [
  { label: '鲜切花材', value: 'flower' },
  { label: '成品花束', value: 'bouquet' },
  { label: '多肉植物', value: 'succulent' },
  { label: '绿植', value: 'greenPlant' },
  { label: '花器', value: 'vase' },
  { label: '礼品', value: 'gift' }
]

const sceneOptions = [
  '自我取悦',
  '节日送礼',
  '生日纪念',
  '家居软装',
  '办公空间',
  '乔迁开业',
  '探望慰问',
  '婚礼聚会'
]

const colorOptions = [
  '粉色',
  '白色',
  '红色',
  '紫色',
  '黄色',
  '绿色',
  '香槟色',
  '奶油色',
  '混色'
]

const rules = {
  name: [
    {
      required: true,
      message: '请输入商品名称',
      trigger: 'blur'
    }
  ],
  type: [
    {
      required: true,
      message: '请选择商品类型',
      trigger: 'change'
    }
  ],
  priceYuan: [
    {
      required: true,
      message: '请输入价格',
      trigger: 'change'
    }
  ],
  unit: [
    {
      required: true,
      message: '请输入销售单位',
      trigger: 'blur'
    }
  ]
}

async function loadProduct() {
  if (!isEdit.value) return

  try {
    const item = await adminApi.getProduct(
      String(route.params.id)
    )

    Object.assign(form, {
      ...item,
      priceYuan: Number(item.priceFen || 0) / 100,
      sceneTags: item.sceneTags || [],
      colorTags: item.colorTags || []
    })
  } catch (error) {
    ElMessage.error(error.message || '商品数据加载失败')
  }
}

async function save() {
  await formRef.value?.validate()
  saving.value = true

  try {
    const saved = await adminApi.saveProduct({
      ...form,
      priceFen: Math.round(
        Number(form.priceYuan || 0) * 100
      )
    })

    ElMessage.success('商品已保存')
    router.replace(`/products/${saved._id}`)
  } catch (error) {
    ElMessage.error(error.message || '保存商品失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadProduct)
</script>
