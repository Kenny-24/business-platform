<template>
  <div class="video-uploader">
    <el-upload
      :show-file-list="false"
      :http-request="handleUpload"
      accept="video/*"
    >
      <div class="video-uploader__box">
        <video
          v-if="displayUrl"
          :src="displayUrl"
          controls
          preload="metadata"
        />
        <div v-else class="video-uploader__empty">
          <span>上传商品视频</span>
          <small>MP4、MOV 等，最大 80MB</small>
        </div>
        <div v-if="loading" class="video-uploader__loading">正在上传</div>
      </div>
    </el-upload>

    <div v-if="modelValue" class="video-uploader__footer">
      <span>视频已上传</span>
      <el-button link type="danger" @click="clear">移除</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { uploadVideo } from '../services/cloudbase'
import { feedback } from '../utils/feedback'

const props = defineProps({
  modelValue: { type: String, default: '' },
  previewUrl: { type: String, default: '' },
  folder: { type: String, default: 'product-videos' }
})

const emit = defineEmits(['update:modelValue', 'update:previewUrl'])
const loading = ref(false)
const localPreview = ref('')
const displayUrl = computed(() => localPreview.value || props.previewUrl)

async function handleUpload(option) {
  if (loading.value) return
  loading.value = true
  try {
    const fileId = await uploadVideo(option.file, props.folder)
    if (localPreview.value) URL.revokeObjectURL(localPreview.value)
    localPreview.value = URL.createObjectURL(option.file)
    emit('update:modelValue', fileId)
    emit('update:previewUrl', localPreview.value)
    option.onSuccess?.({ fileID: fileId })
    feedback.success('视频上传成功')
  } catch (error) {
    option.onError?.(error)
    feedback.error(error, '视频上传失败')
  } finally {
    loading.value = false
  }
}

function clear() {
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
  localPreview.value = ''
  emit('update:modelValue', '')
  emit('update:previewUrl', '')
}

onBeforeUnmount(() => {
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
})
</script>

<style scoped>
.video-uploader__box {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 190px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px dashed var(--el-border-color);
  border-radius: 14px;
  background: #faf9f6;
}

.video-uploader__box video {
  width: 100%;
  max-height: 360px;
  background: #1f1f1f;
}

.video-uploader__empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--text-secondary);
  text-align: center;
}

.video-uploader__empty small {
  color: var(--text-tertiary);
}

.video-uploader__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.82);
}

.video-uploader__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
