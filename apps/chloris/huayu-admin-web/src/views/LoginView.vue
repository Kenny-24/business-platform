<template>
  <main class="login-page">
    <section class="login-panel">
      <header class="login-brand">
        <div class="login-brand__mark">
          <img src="/brand/chloris-logo.png" alt="Chloris" />
        </div>
        <div class="login-brand__text">
          <strong>Chloris 商户管理</strong>
          <span>商品、库存与内容管理</span>
        </div>
      </header>

      <el-alert
        v-if="!cloudConfig.accessKeyConfigured"
        class="login-alert"
        type="error"
        :closable="false"
        title="尚未配置 Publishable Key"
        description="请打开 public/huayu-config.js 填写 accessKey，然后刷新页面。"
      />

      <el-tabs
        v-model="mode"
        class="login-tabs"
        stretch
        @tab-change="handleTabChange"
      >
        <el-tab-pane
          label="管理员登录"
          name="login"
        >
          <el-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            label-position="top"
            @submit.prevent
          >
            <el-form-item
              label="管理员邮箱"
              prop="email"
            >
              <el-input
                v-model="loginForm.email"
                type="email"
                placeholder="请输入管理员邮箱"
                autocomplete="email"
              />
            </el-form-item>

            <el-form-item
              label="密码"
              prop="password"
            >
              <el-input
                v-model="loginForm.password"
                type="password"
                show-password
                placeholder="请输入密码"
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
              登录管理端
            </el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane
          label="首次初始化"
          name="bootstrap"
        >
          <div class="login-note-box">
            仅在第一次创建店主账号时使用。管理员创建完成后，请使用左侧“管理员登录”。
          </div>

          <el-form
            ref="bootstrapFormRef"
            :model="bootstrapForm"
            :rules="bootstrapRules"
            label-position="top"
            @submit.prevent
          >
            <el-form-item
              label="店主显示名称"
              prop="displayName"
            >
              <el-input
                v-model="bootstrapForm.displayName"
                placeholder="例如 Chloris 店主"
                :disabled="codeSent"
              />
            </el-form-item>

            <el-form-item
              label="登录邮箱"
              prop="email"
            >
              <el-input
                v-model="bootstrapForm.email"
                type="email"
                placeholder="请输入可以接收验证码的邮箱"
                autocomplete="email"
                :disabled="codeSent"
              />
            </el-form-item>

            <el-form-item
              label="登录密码"
              prop="password"
            >
              <el-input
                v-model="bootstrapForm.password"
                type="password"
                show-password
                placeholder="至少 8 位"
                autocomplete="new-password"
                :disabled="codeSent"
              />
            </el-form-item>

            <el-form-item
              label="首次初始化码"
              prop="bootstrapCode"
            >
              <el-input
                v-model="bootstrapForm.bootstrapCode"
                type="password"
                show-password
                placeholder="请输入 adminApi 初始化码"
              />
            </el-form-item>

            <el-form-item
              v-if="codeSent"
              label="邮箱验证码"
              prop="verificationCode"
            >
              <el-input
                v-model="bootstrapForm.verificationCode"
                inputmode="numeric"
                maxlength="8"
                placeholder="请输入邮箱验证码"
                @keyup.enter="completeBootstrap"
              />
            </el-form-item>

            <el-button
              v-if="!codeSent"
              class="login-submit"
              type="primary"
              :loading="loading"
              @click="sendVerificationCode"
            >
              发送邮箱验证码
            </el-button>

            <template v-else>
              <el-button
                class="login-submit"
                type="primary"
                :loading="loading"
                @click="completeBootstrap"
              >
                验证并创建管理员
              </el-button>

              <el-button
                class="login-submit login-submit--secondary"
                :disabled="loading"
                @click="restartBootstrap"
              >
                修改邮箱或重新发送
              </el-button>
            </template>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <footer class="login-footer">
        <span>Chloris（克罗丽丝）</span>
        <span>{{ cloudConfig.envId }}</span>
      </footer>
    </section>
  </main>
</template>

<script setup>
import {
  reactive,
  ref
} from 'vue'
import {
  useRoute,
  useRouter
} from 'vue-router'
import { useAuthStore } from '../stores/auth'
import {
  cloudConfig
} from '../services/cloudbase'
import { feedback } from '../utils/feedback'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const mode = ref('login')
const loading = ref(false)
const codeSent = ref(false)
const loginFormRef = ref()
const bootstrapFormRef = ref()

const loginForm = reactive({
  email: '',
  password: ''
})

const bootstrapForm = reactive({
  displayName: 'Chloris 店主',
  email: '',
  password: '',
  bootstrapCode: '',
  verificationCode: ''
})

const emailRule = {
  type: 'email',
  message: '请输入有效邮箱地址',
  trigger: ['blur', 'change']
}

const loginRules = {
  email: [
    {
      required: true,
      message: '请输入管理员邮箱',
      trigger: 'blur'
    },
    emailRule
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
  email: [
    {
      required: true,
      message: '请输入登录邮箱',
      trigger: 'blur'
    },
    emailRule
  ],
  password: [
    {
      required: true,
      min: 8,
      message: '密码至少 8 位',
      trigger: 'blur'
    }
  ],
  bootstrapCode: [
    {
      required: true,
      message: '请输入首次初始化码',
      trigger: 'blur'
    }
  ],
  verificationCode: [
    {
      required: true,
      message: '请输入邮箱验证码',
      trigger: 'blur'
    }
  ]
}

async function submitLogin() {
  if (loading.value) {
    return
  }

  try {
    await loginFormRef.value?.validate()
  } catch {
    return
  }

  loading.value = true

  try {
    await authStore.login(
      loginForm.email,
      loginForm.password
    )

    feedback.success('登录成功')

    router.replace(
      String(
        route.query.redirect ||
          '/dashboard'
      )
    )
  } catch (error) {
    feedback.error(error, '登录失败')
  } finally {
    loading.value = false
  }
}

async function validateBootstrapBase() {
  try {
    await bootstrapFormRef.value?.validateField([
      'displayName',
      'email',
      'password',
      'bootstrapCode'
    ])

    return true
  } catch {
    return false
  }
}

async function sendVerificationCode() {
  if (loading.value) {
    return
  }

  const valid =
    await validateBootstrapBase()

  if (!valid) {
    return
  }

  loading.value = true

  try {
    await authStore.sendOwnerVerification({
      email: bootstrapForm.email,
      password: bootstrapForm.password,
      bootstrapCode:
        bootstrapForm.bootstrapCode,
      displayName:
        bootstrapForm.displayName
    })

    codeSent.value = true

    feedback.success(
      '验证码已发送，请检查邮箱'
    )
  } catch (error) {
    feedback.error(
      error,
      '验证码发送失败'
    )
  } finally {
    loading.value = false
  }
}

async function completeBootstrap() {
  if (loading.value) {
    return
  }

  try {
    await bootstrapFormRef.value?.validate()
  } catch {
    return
  }

  loading.value = true

  try {
    await authStore.completeOwnerInitialization({
      verificationCode:
        bootstrapForm.verificationCode,
      email: bootstrapForm.email,
      password: bootstrapForm.password,
      bootstrapCode:
        bootstrapForm.bootstrapCode,
      displayName:
        bootstrapForm.displayName
    })

    feedback.success(
      '管理员创建成功'
    )

    router.replace('/dashboard')
  } catch (error) {
    feedback.error(
      error,
      '管理员创建失败'
    )
  } finally {
    loading.value = false
  }
}

function restartBootstrap() {
  authStore.cancelOwnerInitialization()
  codeSent.value = false
  bootstrapForm.verificationCode = ''
}

function handleTabChange(nextMode) {
  if (
    nextMode === 'login' &&
    codeSent.value
  ) {
    restartBootstrap()
  }
}
</script>
