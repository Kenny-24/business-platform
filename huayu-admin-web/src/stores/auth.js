import { defineStore } from 'pinia'
import {
  bootstrapAdmin,
  fetchAdminProfile,
  getSession,
  loginWithPassword,
  logout,
  signUpWithPassword
} from '../services/cloudbase'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    initialized: false,
    session: null,
    admin: null
  }),

  getters: {
    isAuthenticated: (state) =>
      Boolean(state.session && state.admin),

    displayName: (state) =>
      state.admin?.name ||
      state.admin?.username ||
      state.session?.user?.username ||
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

        const admin = await fetchAdminProfile()

        this.session = session
        this.admin = admin
        return true
      } catch (error) {
        this.session = null
        this.admin = null
        return false
      } finally {
        this.initialized = true
      }
    },

    async login(username, password) {
      const session = await loginWithPassword(
        username,
        password
      )

      const admin = await fetchAdminProfile()

      this.session = session
      this.admin = admin
      this.initialized = true
    },

    async initializeOwner({
      username,
      password,
      bootstrapCode,
      displayName
    }) {
      const session = await signUpWithPassword({
        username,
        password,
        nickname: displayName || '花予店主'
      })

      const admin = await bootstrapAdmin({
        bootstrapCode,
        displayName: displayName || '花予店主'
      })

      this.session = session
      this.admin = admin
      this.initialized = true
    },

    async signOut() {
      await logout()
      this.session = null
      this.admin = null
      this.initialized = true
    }
  }
})
