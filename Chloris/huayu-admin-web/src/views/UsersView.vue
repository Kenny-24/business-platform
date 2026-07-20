<template>
  <div>
    <PageHeader
      title="顾客管理"
      description="查看顾客资料、地址数量、订单数量与累计完成金额。"
    >
      <el-button
        :loading="loading"
        @click="loadUsers"
      >
        刷新
      </el-button>
    </PageHeader>

    <el-card
      shadow="never"
      class="panel-card"
    >
      <div class="filter-bar">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索顾客昵称或用户 ID"
          @keyup.enter="loadUsers"
          @clear="loadUsers"
        />
        <el-button
          :loading="loading"
          @click="loadUsers"
        >
          查询
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="users"
        row-key="_id"
      >
        <el-table-column
          label="顾客"
          min-width="250"
        >
          <template #default="{ row }">
            <div class="customer-cell">
              <el-avatar
                :size="42"
                :src="row.avatarUrl"
              >
                花
              </el-avatar>
              <div>
                <strong>{{ row.nickname || 'Chloris 用户' }}</strong>
                <span>{{ row.memberLevelLabel }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="addressCount"
          label="地址"
          width="100"
          align="right"
        />

        <el-table-column
          prop="orderCount"
          label="订单"
          width="100"
          align="right"
        />

        <el-table-column
          label="累计完成金额"
          width="150"
          align="right"
        >
          <template #default="{ row }">
            ¥{{ row.completedAmountText }}
          </template>
        </el-table-column>

        <el-table-column
          prop="points"
          label="积分"
          width="100"
          align="right"
        />

        <el-table-column
          label="注册时间"
          min-width="170"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.createdAtText) }}
          </template>
        </el-table-column>

        <el-table-column
          label="状态"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-tag
              :type="row.enabled === false ? 'danger' : 'success'"
              effect="plain"
              round
            >
              {{ row.enabled === false ? '已停用' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column
          label="操作"
          width="100"
          fixed="right"
          align="right"
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="router.push(`/users/${row._id}`)"
            >
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && !users.length"
        :image-size="64"
        description="暂无顾客记录"
      />
    </el-card>
  </div>
</template>

<script setup>
import {
  onMounted,
  reactive,
  ref
} from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const router = useRouter()
const loading = ref(false)
const users = ref([])
const filters = reactive({ keyword: '' })

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

async function loadUsers() {
  loading.value = true
  try {
    const result = await adminApi.listUsers(filters)
    users.value = result.items || []
  } catch (error) {
    feedback.error(error, '顾客列表加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)
</script>
