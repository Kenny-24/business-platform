<template>
  <span class="status-dot">
    <i :class="`is-${type}`"></i>
    <span>{{ text }}</span>
  </span>
</template>

<script setup>
defineProps({
  text: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'neutral'
  }
})
</script>
