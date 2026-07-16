import { defineStore } from 'pinia'
import {
  beginEmailSignUp,
  bootstrapAdmin,
  completeEmailSignUp,
  fetchAdminProfile,
  getSession,
  loginWithPassword,
  logout,
  resetPendingEmailSignUp
} from '../services/cloudbase'

export const useAuthStore = defineStore(
  'auth',
  {
    state: () => ({
      initialized: false,
      session: null,
      admin: null,
      pendingOwner: null
    }),

    getters: {
      isAuthenticated: (state) =>
        Boolean(state.session && state.admin),

      hasCloudSession: (state) =>
        Boolean(state.session),

      displayName: (state) =>
        state.admin?.name ||
        state.admin?.email ||
        state.session?.user?.email ||
        '花予管理员'
    },

    actions: {
      async restore() {
        try {
          const session = await getSession()

          if (!session) {
            this.session = null
            this.admin = null
            return false
          }

          this.session = session

          try {
            this.admin =
              await fetchAdminProfile()
            return true
          } catch {
            this.admin = null
            return false
          }
        } catch {
          this.session = null
          this.admin = null
          return false
        } finally {
          this.initialized = true
        }
      },

      async login(email, password) {
        const session =
          await loginWithPassword(
            email,
            password
          )

        this.session = session

        try {
          this.admin =
            await fetchAdminProfile()
        } catch (error) {
          this.admin = null

          const adminError = new Error(
            '账号登录成功，但当前账号尚未设置为花予管理员。'
          )

          adminError.code =
            'ADMIN_NOT_INITIALIZED'
          adminError.cause = error

          throw adminError
        }

        this.initialized = true
      },

      async sendOwnerVerification({
        email,
        password,
        bootstrapCode,
        displayName
      }) {
        const result =
          await beginEmailSignUp({
            email,
            password
          })

        this.pendingOwner = {
          email: result.email,
          bootstrapCode,
          displayName:
            displayName || '花予店主'
        }

        return result
      },

      async completeOwnerInitialization({
        verificationCode,
        email,
        password,
        bootstrapCode,
        displayName
      }) {
        const session =
          await completeEmailSignUp({
            verificationCode,
            email,
            password
          })

        this.session = session

        const admin = await bootstrapAdmin({
          bootstrapCode,
          displayName:
            displayName || '花予店主'
        })

        this.admin = admin
        this.pendingOwner = null
        this.initialized = true
      },

      cancelOwnerInitialization() {
        resetPendingEmailSignUp()
        this.pendingOwner = null
      },

      async signOut() {
        await logout()
        this.session = null
        this.admin = null
        this.pendingOwner = null
        this.initialized = true
      }
    }
  }
)
