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
    meta: { public: true, title: '登录' }
  },
  {
    path: '/',
    component: () => import('../layouts/AdminLayout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
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
        meta: { title: '横幅管理' }
      },
      {
        path: 'calendar-events',
        name: 'calendar-events',
        component: () => import('../views/CalendarEventsView.vue'),
        meta: { title: '节日与活动管理' }
      },
      {
        path: 'orders',
        name: 'orders',
        component: () => import('../views/OrdersView.vue'),
        meta: { title: '订单管理' }
      },
      {
        path: 'orders/:id',
        name: 'order-detail',
        component: () => import('../views/OrderDetailView.vue'),
        meta: { title: '订单详情' }
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('../views/UsersView.vue'),
        meta: { title: '顾客管理' }
      },
      {
        path: 'users/:id',
        name: 'user-detail',
        component: () => import('../views/UserDetailView.vue'),
        meta: { title: '顾客详情' }
      },
      {
        path: 'quote-requests',
        name: 'quote-requests',
        component: () => import('../views/QuoteRequestsView.vue'),
        meta: { title: '图片定制报价' }
      },
      {
        path: 'atlas',
        name: 'atlas',
        component: () => import('../views/AtlasView.vue'),
        meta: { title: '图鉴管理' }
      },
      {
        path: 'data-import',
        name: 'data-import',
        component: () => import('../views/DataImportView.vue'),
        meta: { title: '数据导入' }
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
  document.title = `${to.meta.title || '管理中心'} · Chloris（克罗丽丝）`

  if (to.meta.public) return true

  const authStore = useAuthStore()
  if (!authStore.initialized) await authStore.restore()

  if (!authStore.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath }
    }
  }

  return true
})

export default router
