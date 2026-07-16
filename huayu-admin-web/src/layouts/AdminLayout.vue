<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="sidebar-brand">
        <strong>花予</strong>
        <span>商户管理</span>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in menu"
          :key="item.path"
          :to="item.path"
          class="sidebar-nav__item"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="sidebar-account">
        <div class="sidebar-account__name">
          {{ authStore.displayName }}
        </div>
        <div class="sidebar-account__role">
          管理员
        </div>
      </div>
    </aside>

    <main class="admin-main">
      <header class="admin-topbar">
        <div class="admin-topbar__title">
          {{ route.meta.title || '管理后台' }}
        </div>

        <div class="admin-topbar__right">
          <StatusDot
            text="云服务已连接"
            type="success"
          />
          <el-button text @click="handleLogout">
            退出登录
          </el-button>
        </div>
      </header>

      <section class="admin-content">
        <router-view />
      </section>
    </main>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import StatusDot from '../components/StatusDot.vue'
import { feedback } from '../utils/feedback'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const menu = [
  { path: '/dashboard', label: '经营概览' },
  { path: '/products', label: '商品管理' },
  { path: '/inventory', label: '库存管理' },
  { path: '/banners', label: '横幅管理' },
  { path: '/calendar-events', label: '节日管理' },
  { path: '/atlas', label: '花予图鉴' }
]

async function handleLogout() {
  try {
    await ElMessageBox.confirm(
      '确定退出当前管理员账号吗？',
      '退出登录',
      {
        confirmButtonText: '退出',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await authStore.signOut()
    router.replace('/login')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      feedback.error(error, '退出登录失败')
    }
  }
}
</script>
