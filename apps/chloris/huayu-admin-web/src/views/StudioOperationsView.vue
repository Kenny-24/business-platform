<template>
  <div>
    <PageHeader
      title="工作室合作后台"
      description="管理合作工作室、商家微信展示、每日产能，以及订单接单与制作确认。"
    >
      <el-button type="primary" @click="openStudio()">新增工作室</el-button>
    </PageHeader>

    <div class="studio-grid">
      <el-card shadow="never" class="panel-card studio-list-card">
        <template #header>
          <div class="card-head">
            <strong>合作工作室</strong>
            <el-button link @click="load">刷新</el-button>
          </div>
        </template>

        <div
          v-for="item in studios"
          :key="item._id"
          class="studio-card"
          :class="{ active: selectedStudioId === item._id }"
          @click="selectStudio(item)"
        >
          <div>
            <strong>{{ item.name }}</strong>
            <span>
              {{ item.enabled === false ? '已停用' : '合作中' }} ·
              每日 {{ item.defaultDailyOrderLimit }} 单 /
              {{ item.defaultDailyUnitLimit }} 单位
            </span>
          </div>
          <el-button link type="primary" @click.stop="openStudio(item)">设置</el-button>
        </div>
        <el-empty v-if="!studios.length" description="请先新增合作工作室" />
      </el-card>

      <div>
        <el-card shadow="never" class="panel-card">
          <template #header><strong>未来 14 天产能</strong></template>
          <el-table :data="selectedStudio?.capacityRows || []" size="small">
            <el-table-column prop="date" label="日期" width="110" />
            <el-table-column label="订单">
              <template #default="{ row }">{{ row.usedOrders }} / {{ row.maxOrders }}</template>
            </el-table-column>
            <el-table-column label="产能">
              <template #default="{ row }">{{ row.usedUnits }} / {{ row.maxUnits }}</template>
            </el-table-column>
            <el-table-column label="状态">
              <template #default="{ row }">
                <el-tag
                  :type="row.closed ? 'danger' : (row.remainingOrders === 0 || row.remainingUnits === 0 ? 'warning' : 'success')"
                  effect="plain"
                >
                  {{ row.closed ? '停接' : `${row.remainingOrders}单余量` }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>
            <div class="card-head">
              <strong>待履约订单</strong>
              <el-select v-model="orderStatus" size="small" @change="loadOrders">
                <el-option label="全部" value="all" />
                <el-option label="待接单 / 待付款" value="pendingPayment" />
                <el-option label="制作中" value="making" />
                <el-option label="配送中" value="delivering" />
              </el-select>
            </div>
          </template>

          <el-table v-loading="ordersLoading" :data="orders" row-key="_id">
            <el-table-column label="订单" min-width="190">
              <template #default="{ row }">
                <strong>{{ row.orderNo }}</strong>
                <div class="table-secondary">
                  {{ row.customerNickname }} · {{ row.requestedDeliveryDate }} {{ row.requestedDeliverySlot }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="商品" min-width="180">
              <template #default="{ row }">
                {{ row.items?.map((item) => `${item.name}×${item.quantity}`).join('、') }}
              </template>
            </el-table-column>
            <el-table-column label="产能" width="80" prop="capacityUnits" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.statusTone" effect="plain">{{ row.statusLabel }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="190" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'pendingPayment' && !row.assignedStudioId"
                  type="primary"
                  size="small"
                  :disabled="!selectedStudioId"
                  @click="accept(row)"
                >
                  接单
                </el-button>
                <el-button
                  v-if="row.status === 'pendingPayment' && row.assignedStudioId"
                  type="success"
                  size="small"
                  @click="startMaking(row)"
                >
                  确认制作
                </el-button>
                <el-button link @click="router.push(`/orders/${row._id}`)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </div>

    <el-dialog
      v-model="studioVisible"
      :title="studioForm._id ? '编辑工作室' : '新增工作室'"
      width="820px"
    >
      <el-form label-position="top">
        <div class="form-grid form-grid--two">
          <el-form-item label="工作室名称">
            <el-input v-model="studioForm.name" />
          </el-form-item>
          <el-form-item label="工作室编码">
            <el-input v-model="studioForm.studioCode" placeholder="留空自动生成" />
          </el-form-item>
        </div>

        <div class="form-grid form-grid--three">
          <el-form-item label="联系人">
            <el-input v-model="studioForm.contactName" />
          </el-form-item>
          <el-form-item label="电话">
            <el-input v-model="studioForm.phone" />
          </el-form-item>
          <el-form-item label="商家微信号">
            <el-input v-model="studioForm.wechat" placeholder="用于顾客复制微信号" />
          </el-form-item>
        </div>

        <el-form-item label="地址">
          <el-input v-model="studioForm.address" placeholder="工作室经营地址" />
        </el-form-item>

        <el-divider content-position="left">顾客到店取货</el-divider>
        <div class="setting-row">
          <div>
            <strong>开放到店取货</strong>
            <span>启用后，顾客可在结算页选择该工作室作为自提门店。</span>
          </div>
          <el-switch v-model="studioForm.supportsPickup" />
        </div>
        <div v-if="studioForm.supportsPickup" class="form-grid form-grid--two pickup-config-grid">
          <el-form-item label="顾客端门店名称">
            <el-input v-model="studioForm.pickupName" placeholder="留空时使用工作室名称" />
          </el-form-item>
          <el-form-item label="自提联系电话">
            <el-input v-model="studioForm.pickupPhone" placeholder="留空时使用工作室电话" />
          </el-form-item>
          <el-form-item label="自提地址">
            <el-input v-model="studioForm.pickupAddress" placeholder="留空时使用工作室地址" />
          </el-form-item>
          <el-form-item label="自提营业时间">
            <el-input v-model="studioForm.pickupHours" placeholder="例如：每日 10:00–19:00" />
          </el-form-item>
        </div>
        <el-form-item v-if="studioForm.supportsPickup" label="到店提示">
          <el-input
            v-model="studioForm.pickupNotice"
            type="textarea"
            :rows="2"
            maxlength="300"
            show-word-limit
            placeholder="例如：到店后请出示订单号，鲜花建议及时领取。"
          />
        </el-form-item>

        <el-divider content-position="left">“我的”页面展示</el-divider>
        <div class="merchant-assets">
          <el-form-item label="商家头像 / 品牌标识">
            <ImageUploader
              v-model="studioForm.logoFileId"
              v-model:preview-url="studioForm.logoUrl"
              folder="studios/profile-logo"
            />
            <div class="field-tip">显示在“商家微信”卡片和二维码弹窗中，建议上传正方形图片。</div>
          </el-form-item>

          <el-form-item label="我的页面顶部封面">
            <ImageUploader
              v-model="studioForm.profileCoverFileId"
              v-model:preview-url="studioForm.profileCoverUrl"
              folder="studios/profile-cover"
            />
            <div class="field-tip">建议上传横向花艺图片，推荐比例约 4:3，页面会自动裁切。</div>
          </el-form-item>

          <el-form-item label="商家微信二维码">
            <ImageUploader
              v-model="studioForm.wechatQrFileId"
              v-model:preview-url="studioForm.wechatQrUrl"
              folder="studios/wechat-qr"
            />
            <div class="field-tip">顾客点击“添加微信”后弹出，建议上传清晰的个人或企业微信二维码。</div>
          </el-form-item>
        </div>

        <div class="form-grid form-grid--two">
          <el-form-item label="默认每日订单上限">
            <el-input-number v-model="studioForm.defaultDailyOrderLimit" :min="1" />
          </el-form-item>
          <el-form-item label="默认每日产能单位">
            <el-input-number v-model="studioForm.defaultDailyUnitLimit" :min="1" />
          </el-form-item>
        </div>

        <el-form-item label="特殊日期产能">
          <div
            v-for="(row, index) in studioForm.dateOverrides"
            :key="index"
            class="override-row"
          >
            <el-date-picker
              v-model="row.date"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="日期"
            />
            <el-input-number v-model="row.maxOrders" :min="0" placeholder="订单" />
            <el-input-number v-model="row.maxUnits" :min="0" placeholder="产能" />
            <el-switch v-model="row.closed" active-text="停接" />
            <el-button
              link
              type="danger"
              @click="studioForm.dateOverrides.splice(index, 1)"
            >
              删除
            </el-button>
          </div>
          <el-button
            @click="studioForm.dateOverrides.push({ date: '', maxOrders: 0, maxUnits: 0, closed: false, note: '' })"
          >
            添加特殊日期
          </el-button>
        </el-form-item>

        <div class="setting-row">
          <div>
            <strong>启用合作</strong>
            <span>停用后不能分配新订单，也不会作为顾客端默认商家展示。</span>
          </div>
          <el-switch v-model="studioForm.enabled" />
        </div>

        <el-form-item label="备注">
          <el-input v-model="studioForm.note" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button v-if="studioForm._id" type="danger" plain @click="removeStudio">
          删除工作室
        </el-button>
        <el-button @click="studioVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveStudio">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import ImageUploader from '../components/ImageUploader.vue'
import PageHeader from '../components/PageHeader.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const router = useRouter()
const studios = ref([])
const orders = ref([])
const selectedStudioId = ref('')
const orderStatus = ref('all')
const ordersLoading = ref(false)
const studioVisible = ref(false)
const saving = ref(false)

const blank = () => ({
  _id: '',
  studioCode: '',
  name: '',
  contactName: '',
  phone: '',
  wechat: '',
  wechatQrFileId: '',
  wechatQrUrl: '',
  profileCoverFileId: '',
  profileCoverUrl: '',
  logoFileId: '',
  logoUrl: '',
  address: '',
  supportsPickup: true,
  pickupName: '',
  pickupAddress: '',
  pickupPhone: '',
  pickupHours: '',
  pickupNotice: '',
  enabled: true,
  defaultDailyOrderLimit: 10,
  defaultDailyUnitLimit: 20,
  dateOverrides: [],
  note: '',
  sort: 100
})

const studioForm = reactive(blank())
const selectedStudio = computed(
  () => studios.value.find((item) => item._id === selectedStudioId.value) || null
)

async function load() {
  try {
    studios.value = (await adminApi.listStudios()).items || []
    if (!selectedStudioId.value && studios.value[0]) {
      selectedStudioId.value = studios.value[0]._id
    }
    await loadOrders()
  } catch (error) {
    feedback.error(error, '工作室数据加载失败')
  }
}

async function loadOrders() {
  ordersLoading.value = true
  try {
    orders.value = (
      await adminApi.listStudioOrders({
        studioId: selectedStudioId.value,
        status: orderStatus.value
      })
    ).items || []
  } catch (error) {
    feedback.error(error, '订单队列加载失败')
  } finally {
    ordersLoading.value = false
  }
}

function selectStudio(item) {
  selectedStudioId.value = item._id
  loadOrders()
}

function openStudio(item) {
  Object.assign(
    studioForm,
    blank(),
    item ? JSON.parse(JSON.stringify(item)) : {}
  )
  studioVisible.value = true
}

async function saveStudio() {
  if (!studioForm.name) {
    feedback.warning('请输入工作室名称')
    return
  }

  saving.value = true
  try {
    const payload = {
      ...studioForm,
      capacityRows: undefined,
      logoUrl: undefined,
      profileCoverUrl: undefined,
      wechatQrUrl: undefined
    }
    await adminApi.saveStudio(payload)
    feedback.success('工作室已保存')
    studioVisible.value = false
    await load()
  } catch (error) {
    feedback.error(error, '保存失败')
  } finally {
    saving.value = false
  }
}

async function removeStudio() {
  if (!studioForm._id) return

  try {
    await ElMessageBox.confirm(
      `确定删除“${studioForm.name}”吗？存在未完成订单时系统会阻止删除。`,
      '删除工作室',
      { type: 'warning' }
    )
    const removedId = studioForm._id
    await adminApi.deleteStudio(removedId)
    if (selectedStudioId.value === removedId) selectedStudioId.value = ''
    studioVisible.value = false
    feedback.success('工作室已删除')
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      feedback.error(error, '删除失败')
    }
  }
}

async function accept(row) {
  const studio = selectedStudio.value
  if (!studio) return

  try {
    await ElMessageBox.confirm(
      `由“${studio.name}”接单，并按 ${row.requestedDeliveryDate} ${row.requestedDeliverySlot} 占用产能。订单金额不会在接单时再次修改。`,
      '确认接单',
      {
        type: 'warning',
        confirmButtonText: '确认接单',
        cancelButtonText: '取消'
      }
    )
    await adminApi.studioAcceptOrder(row._id, {
      studioId: studio._id,
      deliveryDate: row.requestedDeliveryDate,
      deliverySlot: row.requestedDeliverySlot,
      note: '工作室后台接单'
    })
    feedback.success('接单成功')
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      feedback.error(error, '接单失败')
    }
  }
}

async function startMaking(row) {
  try {
    await ElMessageBox.confirm(
      '确认款项与花材安排无误并开始制作？',
      '确认制作',
      { type: 'warning' }
    )
    await adminApi.studioStartMaking(row._id, {
      paymentStatus: 'offlinePaid'
    })
    feedback.success('已进入制作中')
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      feedback.error(error, '确认制作失败')
    }
  }
}

onMounted(load)
</script>

<style scoped>
.studio-grid {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 18px;
}

.studio-card {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin-bottom: 10px;
  cursor: pointer;
}

.studio-card.active {
  border-color: #738565;
  background: #f7f9f4;
}

.studio-card div {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.studio-card span {
  font-size: 12px;
  color: var(--text-secondary);
}

.merchant-assets {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.field-tip {
  margin-top: 7px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.override-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr auto auto;
  gap: 8px;
  margin-bottom: 8px;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media (max-width: 980px) {
  .studio-grid,
  .merchant-assets {
    grid-template-columns: 1fr;
  }

  .override-row {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
