<template>
  <iframe
    ref="frame"
    class="html-shim"
    :src="resolvedSrc"
    :title="title"
    @load="syncTheme"
  ></iframe>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useData, withBase } from 'vitepress';

interface HtmlShimProps {
  src: string;
  title: string;
}

const props = defineProps<HtmlShimProps>();
const frame = ref<HTMLIFrameElement | null>(null);
const { isDark } = useData();
const resolvedSrc = computed(() => withBase(props.src));

function syncTheme(): void {
  const documentElement = frame.value?.contentDocument?.documentElement;

  if (!documentElement) {
    return;
  }

  documentElement.classList.toggle('dark', isDark.value);
  documentElement.style.colorScheme = isDark.value ? 'dark' : 'light';
}

watch(isDark, syncTheme);
</script>

<style scoped>
.html-shim {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--docs-background);
}
</style>
