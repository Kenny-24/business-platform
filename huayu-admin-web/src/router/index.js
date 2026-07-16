import {
  createRouter,
  createWebHashHistory
} from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: {
      public: true,
      title: '登录'
    }
  },
  {
    path: '/',
    component: () => import('../layouts/AdminLayout.vue'),
    children: [
      {
        path: '',
        redirect: '/dashboard'
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('../views/DashboardView.vue'),
        meta: { title: '经营概览' }
      },
      {
        path: 'products',
        name: 'products',
        component: () => import('../views/ProductsView.vue'),
        meta: { title: '商品管理' }
      },
      {
        path: 'products/new',
        name: 'product-new',
        component: () => import('../views/ProductEditView.vue'),
        meta: { title: '新增商品' }
      },
      {
        path: 'products/:id',
        name: 'product-edit',
        component: () => import('../views/ProductEditView.vue'),
        meta: { title: '编辑商品' }
      },
      {
        path: 'inventory',
        name: 'inventory',
        component: () => import('../views/InventoryView.vue'),
        meta: { title: '库存管理' }
      },
      {
        path: 'banners',
        name: 'banners',
        component: () => import('../views/BannersView.vue'),
        meta: { title: '首页轮播' }
      },
      {
        path: 'atlas',
        name: 'atlas',
        component: () => import('../views/AtlasView.vue'),
        meta: { title: '花予图鉴' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach(async (to) => {
  document.title = `${to.meta.title || '管理后台'} · 花予`

  if (to.meta.public) {
    return true
  }

  const authStore = useAuthStore()

  if (!authStore.initialized) {
    await authStore.restore()
  }

  if (!authStore.isAuthenticated) {
    return {
      name: 'login',
      query: {
        redirect: to.fullPath
      }
    }
  }

  return true
})

export default router
