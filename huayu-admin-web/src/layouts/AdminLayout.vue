<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="brand">
        <span class="brand__mark">花予</span>
        <span class="brand__caption">HUAYU FLORAL</span>
      </div>

      <nav class="admin-nav">
        <RouterLink
          v-for="item in menu"
          :key="item.path"
          :to="item.path"
          class="admin-nav__item"
        >
          <span class="admin-nav__icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="admin-sidebar__footer">
        <div class="admin-user">
          <div class="admin-user__avatar">花</div>
          <div>
            <strong>{{ authStore.displayName }}</strong>
            <span>商户管理员</span>
          </div>
        </div>
      </div>
    </aside>

    <main class="admin-main">
      <header class="admin-topbar">
        <div>
          <span class="admin-topbar__context">花予商户后台</span>
          <strong>{{ route.meta.title || '管理后台' }}</strong>
        </div>

        <div class="admin-topbar__actions">
          <el-tag effect="plain" type="success">
            云开发已连接
          </el-tag>
          <el-button plain @click="handleLogout">
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

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const menu = [
  { path: '/dashboard', label: '经营概览', icon: '◫' },
  { path: '/products', label: '商品管理', icon: '✿' },
  { path: '/inventory', label: '库存管理', icon: '⌁' },
  { path: '/banners', label: '首页轮播', icon: '▣' },
  { path: '/atlas', label: '花予图鉴', icon: '❀' }
]

async function handleLogout() {
  await ElMessageBox.confirm(
    '确定退出花予商户后台吗？',
    '退出登录',
    {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )

  await authStore.signOut()
  router.replace('/login')
}
</script>
