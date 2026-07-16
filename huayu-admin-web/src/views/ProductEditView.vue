<template>
  <div>
    <PageHeader
      :title="
        isEdit ? '编辑商品' : '新增商品'
      "
      description="填写商品基本信息和销售设置。"
    >
      <el-button @click="router.back()">
        返回
      </el-button>
      <el-button
        type="primary"
        :loading="saving"
        @click="save"
      >
        保存
      </el-button>
    </PageHeader>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="editor-layout"
    >
      <div class="editor-layout__main">
        <el-card
          shadow="never"
          class="panel-card"
        >
          <div class="section-title">
            基本信息
          </div>

          <div class="form-grid form-grid--two">
            <el-form-item
              label="商品名称"
              prop="name"
            >
              <el-input
                v-model="form.name"
                placeholder="例如 香槟玫瑰"
              />
            </el-form-item>

            <el-form-item
              label="商品类型"
              prop="type"
            >
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

          <el-form-item label="商品副标题（首页等位置可用）">
            <el-input
              v-model="form.subtitle"
              placeholder="可选；分类页商品卡不会显示该描述"
            />
            <div class="form-tip">
              分类页只展示商品名称、价格和单位，不展示副标题。
            </div>
          </el-form-item>

          <el-form-item label="搜索关键词">
            <el-select
              v-model="form.searchKeywords"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="输入关键词后回车，例如 玫瑰、香槟、送礼"
            />
            <div class="form-tip">
              小程序分类页搜索会匹配商品名称、关键词、场景和颜色标签。
            </div>
          </el-form-item>

          <div class="form-grid form-grid--three">
            <el-form-item
              label="价格（元）"
              prop="priceYuan"
            >
              <el-input-number
                v-model="form.priceYuan"
                :min="0"
                :precision="2"
                :step="1"
                controls-position="right"
              />
            </el-form-item>

            <el-form-item
              label="销售单位"
              prop="unit"
            >
              <el-input
                v-model="form.unit"
                placeholder="枝 / 束 / 盆"
              />
            </el-form-item>

            <el-form-item
              label="库存"
              prop="stock"
            >
              <el-input-number
                v-model="form.stock"
                :min="0"
                :step="1"
                controls-position="right"
              />
            </el-form-item>
          </div>

          <div class="form-grid form-grid--two">
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
        </el-card>

        <el-card
          shadow="never"
          class="panel-card"
        >
          <div class="section-title">
            销售设置
          </div>

          <div class="setting-row">
            <div>
              <strong>商品上架</strong>
              <span>
                开启后顾客端可以看到商品
              </span>
            </div>
            <el-switch v-model="form.onSale" />
          </div>

          <div class="setting-row">
            <div>
              <strong>首页推荐</strong>
              <span>
                开启后优先展示在推荐区域
              </span>
            </div>
            <el-switch
              v-model="form.featured"
            />
          </div>

          <el-form-item
            label="排序值"
            class="sort-field"
          >
            <el-input-number
              v-model="form.sort"
              :min="0"
              :max="9999"
              controls-position="right"
            />
            <div class="form-tip">
              数字越大，排序越靠前。
            </div>
          </el-form-item>
        </el-card>
      </div>

      <aside class="editor-layout__side">
        <el-card
          shadow="never"
          class="panel-card"
        >
          <div class="section-title">
            商品图片
          </div>

          <ImageUploader
            v-model="form.coverFileId"
            v-model:preview-url="form.imageUrl"
            folder="products"
          />

          <div class="form-tip image-tip">
            建议使用 1:1 或 4:5 图片，主体清晰、背景简洁。
          </div>
        </el-card>
      </aside>
    </el-form>
  </div>
</template>

<script setup>
import {
  computed,
  onMounted,
  reactive,
  ref
} from 'vue'
import {
  useRoute,
  useRouter
} from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import ImageUploader from '../components/ImageUploader.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const route = useRoute()
const router = useRouter()
const formRef = ref()
const saving = ref(false)

const isEdit = computed(
  () => Boolean(route.params.id)
)

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
  searchKeywords: [],
  coverFileId: '',
  imageUrl: '',
  sort: 100
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
  }
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
  if (!isEdit.value) {
    return
  }

  try {
    const item = await adminApi.getProduct(
      String(route.params.id)
    )

    Object.assign(form, {
      ...item,
      priceYuan:
        Number(item.priceFen || 0) /
        100,
      sceneTags:
        item.sceneTags || [],
      colorTags:
        item.colorTags || [],
      searchKeywords:
        item.searchKeywords || []
    })
  } catch (error) {
    feedback.error(
      error,
      '商品数据加载失败'
    )
  }
}

async function save() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  saving.value = true

  try {
    const saved =
      await adminApi.saveProduct({
        ...form,
        priceFen: Math.round(
          Number(
            form.priceYuan || 0
          ) * 100
        )
      })

    feedback.success('商品已保存')

    router.replace(
      `/products/${saved._id}`
    )
  } catch (error) {
    feedback.error(
      error,
      '保存商品失败'
    )
  } finally {
    saving.value = false
  }
}

onMounted(loadProduct)
</script>
