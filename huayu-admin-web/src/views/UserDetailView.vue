<template>
  <div>
    <PageHeader
      title="顾客详情"
      :description="user ? user.nickname : '查看顾客资料、收货地址和历史订单。'"
    >
      <el-button @click="router.push('/users')">
        返回列表
      </el-button>
    </PageHeader>

    <div
      v-if="loading"
      class="admin-loading-card"
    >
      <el-skeleton :rows="7" animated />
    </div>

    <template v-else-if="user">
      <section class="customer-profile-card">
        <el-avatar
          :size="66"
          :src="user.avatarUrl"
        >
          花
        </el-avatar>
        <div>
          <h2>{{ user.nickname || '花予用户' }}</h2>
          <p>{{ user.memberLevelLabel }} · {{ user.points || 0 }} 积分</p>
          <small>用户 ID：{{ user._id }}</small>
        </div>
      </section>

      <section class="admin-detail-grid">
        <div class="admin-detail-main">
          <el-card
            shadow="never"
            class="panel-card"
          >
            <template #header>
              <strong>历史订单</strong>
            </template>

            <el-table
              :data="user.orders || []"
              row-key="_id"
            >
              <el-table-column
                prop="orderNo"
                label="订单号"
                min-width="190"
              />
              <el-table-column
                label="状态"
                width="100"
              >
                <template #default="{ row }">
                  {{ row.statusLabel }}
                </template>
              </el-table-column>
              <el-table-column
                label="金额"
                width="110"
                align="right"
              >
                <template #default="{ row }">
                  ¥{{ row.totalAmountText }}
                </template>
              </el-table-column>
              <el-table-column
                label="时间"
                min-width="170"
              >
                <template #default="{ row }">
                  {{ formatDateTime(row.createdAtText) }}
                </template>
              </el-table-column>
              <el-table-column
                label="操作"
                width="90"
                align="right"
              >
                <template #default="{ row }">
                  <el-button
                    link
                    type="primary"
                    @click="router.push(`/orders/${row._id}`)"
                  >
                    查看
                  </el-button>
                </template>
              </el-table-column>
            </el-table>

            <el-empty
              v-if="!user.orders?.length"
              :image-size="54"
              description="暂无订单"
            />
          </el-card>
        </div>

        <aside class="admin-detail-side">
          <el-card
            shadow="never"
            class="panel-card"
          >
            <template #header>
              <strong>收货地址</strong>
            </template>

            <div
              v-for="address in user.addresses || []"
              :key="address._id"
              class="admin-address-item"
            >
              <div>
                <strong>{{ address.receiverName }}</strong>
                <span>{{ address.phoneMasked }}</span>
                <el-tag
                  v-if="address.isDefault"
                  size="small"
                  type="success"
                  effect="plain"
                >
                  默认
                </el-tag>
              </div>
              <p>
                {{ address.province }}{{ address.city }}{{ address.district }}{{ address.detail }}
              </p>
            </div>

            <el-empty
              v-if="!user.addresses?.length"
              :image-size="54"
              description="暂无收货地址"
            />
          </el-card>
        </aside>
      </section>
    </template>
  </div>
</template>

<script setup>
import {
  onMounted,
  ref
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const user = ref(null)

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

async function loadUser() {
  loading.value = true
  try {
    user.value = await adminApi.getUser(route.params.id)
  } catch (error) {
    feedback.error(error, '顾客详情加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadUser)
</script>
