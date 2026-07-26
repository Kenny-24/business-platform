<template>
  <div>
    <PageHeader
      :title="isEdit ? '编辑商品' : '新增商品'"
      description="维护商品基础信息、详情图和高客单商品视频。"
    >
      <el-button @click="router.back()">返回</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </PageHeader>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="editor-layout"
    >
      <div class="editor-layout__main">
        <el-card shadow="never" class="panel-card">
          <div class="section-title">基本信息</div>

          <div class="form-grid form-grid--two">
            <el-form-item label="商品编码 / SKU">
              <el-input v-model="form.sku" placeholder="例如 FLW-0001；留空由系统生成" />
              <div class="form-tip">用于批量更新、节日关联和长期识别，保存后不建议修改。</div>
            </el-form-item>

            <el-form-item label="商品名称" prop="name">
              <el-input v-model="form.name" placeholder="例如 香槟玫瑰" />
            </el-form-item>
          </div>

          <div class="form-grid form-grid--two">
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

            <el-form-item label="商品分类">
              <el-input v-model="form.category" placeholder="例如 玫瑰、生日花束、多肉组合" />
            </el-form-item>
          </div>

          <el-form-item label="商品副标题">
            <el-input v-model="form.subtitle" placeholder="一句话说明作品风格或适用场景" />
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
          </el-form-item>

          <div class="form-grid form-grid--three">
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
              <el-input v-model="form.unit" placeholder="枝 / 束 / 盆" />
            </el-form-item>

            <el-form-item label="库存" prop="stock">
              <el-input-number v-model="form.stock" :min="0" :step="1" controls-position="right" />
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
                <el-option v-for="tag in sceneOptions" :key="tag" :label="tag" :value="tag" />
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
                <el-option v-for="tag in colorOptions" :key="tag" :label="tag" :value="tag" />
              </el-select>
            </el-form-item>
          </div>

        </el-card>

        <el-card shadow="never" class="panel-card">
          <div class="section-title">商品详情文案</div>

          <div class="form-grid form-grid--two">
            <el-form-item label="花材说明">
              <el-input
                v-model="form.flowerMaterialInfo"
                type="textarea"
                :rows="4"
                maxlength="1000"
                show-word-limit
                placeholder="说明主花材、配花及季节替换规则"
              />
            </el-form-item>

            <el-form-item label="护理建议">
              <el-input
                v-model="form.careDescription"
                type="textarea"
                :rows="4"
                maxlength="1000"
                show-word-limit
                placeholder="收到后的醒花、换水和摆放说明"
              />
            </el-form-item>
          </div>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <div class="section-title">详情图片</div>
          <div class="form-tip detail-media-tip">
            商品详情以图片展示为主。建议上传 3–6 张不同角度和局部花材图片；简单商品只上传图片即可。
          </div>

          <div class="gallery-editor-grid">
            <div v-for="(_, index) in form.galleryFileIds" :key="index" class="gallery-editor-item">
              <ImageUploader
                v-model="form.galleryFileIds[index]"
                v-model:preview-url="form.galleryUrls[index]"
                folder="products/gallery"
              />
              <el-button
                v-if="form.galleryFileIds.length > 1"
                link
                type="danger"
                @click="removeGallerySlot(index)"
              >删除此位置</el-button>
            </div>
          </div>

          <el-button v-if="form.galleryFileIds.length < 8" @click="addGallerySlot">
            新增详情图片位置
          </el-button>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <div class="section-title">商品视频（选填）</div>
          <div class="form-tip detail-media-tip">
            建议高客单价、大型花艺、商业布置和复杂礼盒上传短视频；普通花束无需上传视频。
          </div>

          <VideoUploader
            v-model="form.videoFileId"
            v-model:preview-url="form.videoUrl"
            folder="products/videos"
          />

          <div class="video-poster-field">
            <div class="section-subtitle">视频封面</div>
            <ImageUploader
              v-model="form.videoPosterFileId"
              v-model:preview-url="form.videoPosterUrl"
              folder="products/video-posters"
            />
          </div>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <div class="section-title">商业运营设置</div>

          <div class="form-grid form-grid--two">
            <el-form-item label="销售模式">
              <el-radio-group v-model="form.salesMode">
                <el-radio-button value="spot">现货销售</el-radio-button>
                <el-radio-button value="preorder">预约销售</el-radio-button>
              </el-radio-group>
              <div class="form-tip">现货最早可选择下单后 2 小时；预约商品按预售配送区间下单。</div>
            </el-form-item>
            <el-form-item label="履约工作室">
              <el-select v-model="form.studioId" clearable placeholder="未指定时由接单后台分配">
                <el-option v-for="item in studioOptions" :key="item._id" :label="item.name" :value="item._id" />
              </el-select>
            </el-form-item>
          </div>

          <div class="form-grid form-grid--two">
            <el-form-item label="节日 / 预售活动">
              <el-select v-model="form.festivalCampaignId" clearable placeholder="例如情人节预定">
                <el-option v-for="item in campaignOptions" :key="item._id" :label="`${item.name} · ${item.statusLabel}`" :value="item._id" />
              </el-select>
            </el-form-item>
            <el-form-item label="单件产能单位">
              <el-input-number v-model="form.productionUnits" :min="1" :max="20" controls-position="right" />
              <div class="form-tip">用于工作室每日产能校验；普通花束建议 1，复杂定制可设 2–5。</div>
            </el-form-item>
          </div>

          <div v-if="form.salesMode === 'preorder'" class="form-grid form-grid--two">
            <el-form-item label="预约开放时间">
              <el-date-picker v-model="preorderRange" type="datetimerange" value-format="YYYY-MM-DD HH:mm:ss" range-separator="至" start-placeholder="开始预约" end-placeholder="停止预约" />
            </el-form-item>
            <el-form-item label="允许配送日期">
              <el-date-picker v-model="deliveryRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="配送开始" end-placeholder="配送结束" />
            </el-form-item>
          </div>

          <div v-if="form.salesMode === 'preorder'" class="form-grid form-grid--two">
            <el-form-item label="预约截止时间">
              <el-date-picker v-model="form.reservationDeadlineAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="超过后不再接受预约" />
            </el-form-item>
            <el-form-item label="预约限量">
              <el-input-number v-model="form.reservationQuota" :min="0" controls-position="right" />
              <div class="form-tip">填 0 表示仅受商品库存和活动总量限制。</div>
            </el-form-item>
          </div>

          <div class="setting-row">
            <div><strong>限时推出</strong><span>到达开始时间自动展示，结束后自动下架</span></div>
            <el-switch v-model="form.limitedTimeEnabled" />
          </div>
          <el-form-item v-if="form.limitedTimeEnabled" label="限时销售窗口">
            <el-date-picker v-model="limitedRange" type="datetimerange" value-format="YYYY-MM-DD HH:mm:ss" range-separator="至" start-placeholder="自动上架" end-placeholder="自动下架" />
          </el-form-item>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <div class="section-title">销售设置</div>

          <div class="setting-row">
            <div>
              <strong>商品上架</strong>
              <span>开启后顾客端可以看到商品</span>
            </div>
            <el-switch v-model="form.onSale" />
          </div>

          <div class="setting-row">
            <div>
              <strong>首页推荐</strong>
              <span>开启后优先展示在推荐区域</span>
            </div>
            <el-switch v-model="form.featured" />
          </div>

          <el-form-item label="排序值" class="sort-field">
            <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
            <div class="form-tip">数字越大，排序越靠前。</div>
          </el-form-item>
        </el-card>
      </div>

      <aside class="editor-layout__side">
        <el-card shadow="never" class="panel-card sticky-cover-card">
          <div class="section-title">商品主图</div>
          <ImageUploader
            v-model="form.coverFileId"
            v-model:preview-url="form.imageUrl"
            folder="products"
          />
          <div class="form-tip image-tip">主图用于首页和商品列表。建议使用 4:5 图片，主体清晰、背景简洁。</div>
        </el-card>
      </aside>
    </el-form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import ImageUploader from '../components/ImageUploader.vue'
import VideoUploader from '../components/VideoUploader.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const route = useRoute()
const router = useRouter()
const formRef = ref()
const saving = ref(false)
const campaignOptions = ref([])
const studioOptions = ref([])
const isEdit = computed(() => Boolean(route.params.id))
const limitedRange = computed({ get: () => form.saleStartAt && form.saleEndAt ? [form.saleStartAt, form.saleEndAt] : [], set: (value) => { form.saleStartAt = value?.[0] || ''; form.saleEndAt = value?.[1] || '' } })
const preorderRange = computed({ get: () => form.preorderStartAt && form.preorderEndAt ? [form.preorderStartAt, form.preorderEndAt] : [], set: (value) => { form.preorderStartAt = value?.[0] || ''; form.preorderEndAt = value?.[1] || '' } })
const deliveryRange = computed({ get: () => form.deliveryStartDate && form.deliveryEndDate ? [form.deliveryStartDate, form.deliveryEndDate] : [], set: (value) => { form.deliveryStartDate = value?.[0] || ''; form.deliveryEndDate = value?.[1] || '' } })

const form = reactive({
  _id: '',
  sku: '',
  type: 'flower',
  category: '',
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
  salesMode: 'spot',
  limitedTimeEnabled: false,
  saleStartAt: '',
  saleEndAt: '',
  festivalCampaignId: '',
  preorderStartAt: '',
  preorderEndAt: '',
  deliveryStartDate: '',
  deliveryEndDate: '',
  reservationDeadlineAt: '',
  reservationQuota: 0,
  productionUnits: 1,
  studioId: '',
  coverFileId: '',
  imageUrl: '',
  galleryFileIds: [''],
  galleryUrls: [''],
  videoFileId: '',
  videoUrl: '',
  videoPosterFileId: '',
  videoPosterUrl: '',
  flowerMaterialInfo: '',
  careDescription: '',
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
  '给自己', '自我取悦', '日常', '办公室', '生日', '庆祝',
  '恋人', '告白', '浪漫', '纪念', '周年', '感谢', '朋友',
  '长辈', '探望', '慰问', '康复', '清新', '居家', '软装',
  '空间', '桌花', '瓶插', '商业'
]

const colorOptions = [
  '粉色', '白色', '红色', '紫色', '黄色', '绿色',
  '蓝色', '香槟色', '奶油色', '混色'
]

const rules = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择商品类型', trigger: 'change' }],
  priceYuan: [{ required: true, message: '请输入价格', trigger: 'change' }],
  unit: [{ required: true, message: '请输入销售单位', trigger: 'blur' }]
}

function normalizeMediaArrays(fileIds = [], urls = []) {
  const nextIds = Array.isArray(fileIds) ? [...fileIds] : []
  const nextUrls = Array.isArray(urls) ? [...urls] : []
  const size = Math.max(nextIds.length, nextUrls.length, 1)
  while (nextIds.length < size) nextIds.push('')
  while (nextUrls.length < size) nextUrls.push('')
  return { nextIds, nextUrls }
}

function addGallerySlot() {
  if (form.galleryFileIds.length >= 8) return
  form.galleryFileIds.push('')
  form.galleryUrls.push('')
}

function removeGallerySlot(index) {
  form.galleryFileIds.splice(index, 1)
  form.galleryUrls.splice(index, 1)
  if (!form.galleryFileIds.length) {
    form.galleryFileIds.push('')
    form.galleryUrls.push('')
  }
}

async function loadCommercialOptions() {
  try {
    const [campaigns, studios] = await Promise.all([
      adminApi.listFestivalCampaigns(),
      adminApi.listStudios()
    ])
    campaignOptions.value = campaigns.items || []
    studioOptions.value = (studios.items || []).filter((item) => item.enabled !== false)
  } catch (error) {
    feedback.error(error, '商业运营选项加载失败')
  }
}

async function loadProduct(productId = String(route.params.id || '')) {
  if (!productId) return

  try {
    const item = await adminApi.getProduct(productId)
    const media = normalizeMediaArrays(item.galleryFileIds, item.galleryUrls)

    Object.assign(form, {
      ...item,
      priceYuan: Number(item.priceFen || 0) / 100,
      sceneTags: item.sceneTags || [],
      colorTags: item.colorTags || [],
      searchKeywords: item.searchKeywords || [],
      salesMode: item.salesMode || 'spot',
      productionUnits: Number(item.productionUnits || 1),
      galleryFileIds: media.nextIds,
      galleryUrls: media.nextUrls,
      videoFileId: item.videoFileId || '',
      videoUrl: item.videoUrl || '',
      videoPosterFileId: item.videoPosterFileId || '',
      videoPosterUrl: item.videoPosterUrl || ''
    })
  } catch (error) {
    feedback.error(error, '商品数据加载失败')
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
    const galleryFileIds = form.galleryFileIds.filter(Boolean)
    const saved = await adminApi.saveProduct({
      ...form,
      galleryFileIds,
      galleryUrls: undefined,
      imageUrl: undefined,
      videoUrl: undefined,
      videoPosterUrl: undefined,
      priceFen: Math.round(Number(form.priceYuan || 0) * 100)
    })

    feedback.success('商品已保存')
    await router.replace(`/products/${saved._id}`)
    await loadProduct(saved._id)
  } catch (error) {
    feedback.error(error, '保存商品失败')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadCommercialOptions(), loadProduct()])
})
</script>

<style scoped>
.detail-media-tip {
  margin-bottom: 18px;
}

.gallery-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 18px;
}

.gallery-editor-item {
  min-width: 0;
}

.video-poster-field {
  max-width: 360px;
  margin-top: 24px;
}

.section-subtitle {
  margin-bottom: 12px;
  color: var(--text-primary);
  font-weight: 600;
}

.sticky-cover-card {
  position: sticky;
  top: 88px;
}

@media (max-width: 900px) {
  .gallery-editor-grid {
    grid-template-columns: 1fr;
  }
}
</style>
