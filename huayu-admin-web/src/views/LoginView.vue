<template>
  <div class="login-page">
    <div class="login-visual">
      <div class="login-visual__shade"></div>
      <div class="login-visual__copy">
        <span>HUAYU FLORAL STUDIO</span>
        <h1>把花予你，<br />也予日常。</h1>
        <p>统一管理商品、库存、首页内容与花材图鉴。</p>
      </div>
    </div>

    <div class="login-panel">
      <div class="login-card">
        <div class="login-brand">
          <strong>花予</strong>
          <span>商户管理后台</span>
        </div>

        <el-alert
          v-if="!cloudConfig.accessKeyConfigured"
          class="config-alert"
          type="error"
          :closable="false"
          title="尚未配置 Publishable Key"
          description="请先修改 public/huayu-config.js 中的 accessKey，然后刷新页面。"
        />

        <el-tabs v-model="mode" stretch>
          <el-tab-pane label="管理员登录" name="login">
            <el-form
              ref="loginFormRef"
              :model="loginForm"
              :rules="loginRules"
              label-position="top"
              @submit.prevent
            >
              <el-form-item label="管理员用户名" prop="username">
                <el-input
                  v-model="loginForm.username"
                  placeholder="例如 huayu_owner"
                  autocomplete="username"
                />
              </el-form-item>

              <el-form-item label="密码" prop="password">
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  show-password
                  placeholder="请输入管理员密码"
                  autocomplete="current-password"
                  @keyup.enter="submitLogin"
                />
              </el-form-item>

              <el-button
                class="login-submit"
                type="primary"
                :loading="loading"
                @click="submitLogin"
              >
                登录后台
              </el-button>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="首次初始化" name="bootstrap">
            <el-alert
              class="bootstrap-alert"
              type="warning"
              :closable="false"
              title="仅在第一次创建店主账号时使用。成功后该入口会被云函数自动锁定。"
            />

            <el-form
              ref="bootstrapFormRef"
              :model="bootstrapForm"
              :rules="bootstrapRules"
              label-position="top"
              @submit.prevent
            >
              <el-form-item label="店主显示名称" prop="displayName">
                <el-input
                  v-model="bootstrapForm.displayName"
                  placeholder="例如 花予店主"
                />
              </el-form-item>

              <el-form-item label="登录用户名" prop="username">
                <el-input
                  v-model="bootstrapForm.username"
                  placeholder="5—24位英文、数字或 _-"
                  autocomplete="username"
                />
              </el-form-item>

              <el-form-item label="登录密码" prop="password">
                <el-input
                  v-model="bootstrapForm.password"
                  type="password"
                  show-password
                  placeholder="至少8位，建议包含大小写和数字"
                  autocomplete="new-password"
                />
              </el-form-item>

              <el-form-item label="首次初始化码" prop="bootstrapCode">
                <el-input
                  v-model="bootstrapForm.bootstrapCode"
                  type="password"
                  show-password
                  placeholder="默认开发码见部署说明"
                />
              </el-form-item>

              <el-button
                class="login-submit"
                type="primary"
                :loading="loading"
                @click="submitBootstrap"
              >
                创建首位管理员
              </el-button>
            </el-form>
          </el-tab-pane>
        </el-tabs>

        <p class="login-note">
          环境：cloudbase-d6gspds9z5e38b6f0
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { cloudConfig } from '../services/cloudbase'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const mode = ref('login')
const loading = ref(false)
const loginFormRef = ref()
const bootstrapFormRef = ref()

const loginForm = reactive({
  username: '',
  password: ''
})

const bootstrapForm = reactive({
  displayName: '花予店主',
  username: '',
  password: '',
  bootstrapCode: ''
})

const loginRules = {
  username: [
    {
      required: true,
      message: '请输入用户名',
      trigger: 'blur'
    }
  ],
  password: [
    {
      required: true,
      message: '请输入密码',
      trigger: 'blur'
    }
  ]
}

const bootstrapRules = {
  displayName: [
    {
      required: true,
      message: '请输入显示名称',
      trigger: 'blur'
    }
  ],
  username: [
    {
      required: true,
      min: 5,
      max: 24,
      message: '用户名长度应为5—24位',
      trigger: 'blur'
    },
    {
      pattern: /^[A-Za-z0-9][A-Za-z0-9_.:+@-]*$/,
      message: '用户名只能包含英文、数字和 -_.:+@',
      trigger: 'blur'
    }
  ],
  password: [
    {
      required: true,
      min: 8,
      message: '密码至少8位',
      trigger: 'blur'
    }
  ],
  bootstrapCode: [
    {
      required: true,
      message: '请输入首次初始化码',
      trigger: 'blur'
    }
  ]
}

async function submitLogin() {
  await loginFormRef.value?.validate()
  loading.value = true

  try {
    await authStore.login(
      loginForm.username,
      loginForm.password
    )

    ElMessage.success('登录成功')
    router.replace(
      String(route.query.redirect || '/dashboard')
    )
  } catch (error) {
    ElMessage.error(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}

async function submitBootstrap() {
  await bootstrapFormRef.value?.validate()
  loading.value = true

  try {
    await authStore.initializeOwner(bootstrapForm)
    ElMessage.success('首位管理员创建成功')
    router.replace('/dashboard')
  } catch (error) {
    ElMessage.error(error.message || '初始化失败')
  } finally {
    loading.value = false
  }
}
</script>
