import {createRouter,createWebHistory} from 'vue-router';
import Login from './views/Login.vue';import Dashboard from './views/Dashboard.vue';import Products from './views/Products.vue';import Categories from './views/Categories.vue';import Orders from './views/Orders.vue';import Settings from './views/Settings.vue';
const router=createRouter({history:createWebHistory(),routes:[{path:'/login',component:Login},{path:'/',redirect:'/dashboard'},{path:'/dashboard',component:Dashboard},{path:'/products',component:Products},{path:'/categories',component:Categories},{path:'/orders',component:Orders},{path:'/settings',component:Settings}]});
router.beforeEach(to=>{if(to.path!='/login'&&!localStorage.getItem('admin_token'))return '/login';});export default router;
