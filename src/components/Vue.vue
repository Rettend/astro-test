<script lang="ts" setup>
import { ref } from 'vue'

const likes = ref(0)
</script>

<template>
  <button @click="likes++">
    Likes {{ likes }}
  </button>
</template>
