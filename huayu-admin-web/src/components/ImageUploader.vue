<template>
  <div class="image-uploader">
    <el-upload
      :show-file-list="false"
      :http-request="handleUpload"
      accept="image/*"
    >
      <div
        class="image-uploader__surface"
        :class="{ 'is-loading': loading }"
      >
        <img
          v-if="displayUrl"
          :src="displayUrl"
          alt="图片预览"
        />

        <div v-else class="image-uploader__empty">
          <span class="image-uploader__plus">＋</span>
          <strong>上传图片</strong>
          <small>JPG / PNG / WEBP，最多 5MB</small>
        </div>

        <div v-if="loading" class="image-uploader__loading">
          正在上传…
        </div>
      </div>
    </el-upload>

    <div v-if="modelValue" class="image-uploader__meta">
      <span>云文件已就绪</span>
      <el-button link type="danger" @click="clear">
        移除
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { uploadImage } from '../services/cloudbase'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  previewUrl: {
    type: String,
    default: ''
  },
  folder: {
    type: String,
    default: 'products'
  }
})

const emit = defineEmits([
  'update:modelValue',
  'update:previewUrl'
])

const loading = ref(false)
const localPreview = ref('')

const displayUrl = computed(
  () => localPreview.value || props.previewUrl
)

async function handleUpload(option) {
  loading.value = true

  try {
    const fileId = await uploadImage(
      option.file,
      props.folder
    )

    localPreview.value = URL.createObjectURL(option.file)
    emit('update:modelValue', fileId)
    emit('update:previewUrl', localPreview.value)
    option.onSuccess?.({ fileID: fileId })
    ElMessage.success('图片上传成功')
  } catch (error) {
    option.onError?.(error)
    ElMessage.error(error.message || '图片上传失败')
  } finally {
    loading.value = false
  }
}

function clear() {
  localPreview.value = ''
  emit('update:modelValue', '')
  emit('update:previewUrl', '')
}
</script>
