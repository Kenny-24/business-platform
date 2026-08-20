<template>
  <div class="image-uploader">
    <el-upload
      :show-file-list="false"
      :http-request="handleUpload"
      accept="image/*"
    >
      <div class="image-uploader__box">
        <img
          v-if="displayUrl"
          :src="displayUrl"
          alt="图片预览"
        />

        <div
          v-else
          class="image-uploader__empty"
        >
          <span>上传图片</span>
          <small>JPG、PNG、WEBP，最大 5MB</small>
        </div>

        <div
          v-if="loading"
          class="image-uploader__loading"
        >
          正在上传
        </div>
      </div>
    </el-upload>

    <div
      v-if="modelValue"
      class="image-uploader__footer"
    >
      <span>图片已上传</span>
      <el-button
        link
        type="danger"
        @click="clear"
      >
        移除
      </el-button>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  onBeforeUnmount,
  ref
} from 'vue'
import { uploadImage } from '../services/cloudbase'
import { feedback } from '../utils/feedback'

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
  () =>
    localPreview.value ||
    props.previewUrl
)

async function handleUpload(option) {
  if (loading.value) {
    return
  }

  loading.value = true

  try {
    const fileId = await uploadImage(
      option.file,
      props.folder
    )

    if (localPreview.value) {
      URL.revokeObjectURL(
        localPreview.value
      )
    }

    localPreview.value =
      URL.createObjectURL(option.file)

    emit('update:modelValue', fileId)
    emit(
      'update:previewUrl',
      localPreview.value
    )

    option.onSuccess?.({
      fileID: fileId
    })

    feedback.success('图片上传成功')
  } catch (error) {
    option.onError?.(error)
    feedback.error(error, '图片上传失败')
  } finally {
    loading.value = false
  }
}

function clear() {
  if (localPreview.value) {
    URL.revokeObjectURL(
      localPreview.value
    )
  }

  localPreview.value = ''
  emit('update:modelValue', '')
  emit('update:previewUrl', '')
}

onBeforeUnmount(() => {
  if (localPreview.value) {
    URL.revokeObjectURL(
      localPreview.value
    )
  }
})
</script>
