<template>
  <div class="mermaid-container" :class="{ 'is-rendered': !!svgHtml, 'has-error': !!error }">
    <div v-if="svgHtml" v-html="svgHtml" class="mermaid-diagram"></div>
    <div v-else-if="error" class="mermaid-error">
      <p class="mermaid-error-title">Chyba vykreslení diagramu:</p>
      <pre class="mermaid-error-msg">{{ error }}</pre>
    </div>
    <div v-else class="mermaid-loading">
      <span class="mermaid-spinner"></span>
      <span>Načítání diagramu...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useData } from 'vitepress';

interface MermaidProps {
  id: string;
  code: string;
}

const props = defineProps<MermaidProps>();

const { isDark } = useData();
const svgHtml = ref<string>('');
const error = ref<string>('');
let renderSeq = 0;

async function renderDiagram(): Promise<void> {
  if (typeof window === 'undefined') return;

  const currentSeq = ++renderSeq;
  const uniqueRenderId = `${props.id}-${currentSeq}`;

  try {
    const mermaidModule = await import('mermaid');
    const mermaid = mermaidModule.default ?? mermaidModule;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: isDark.value ? 'dark' : 'default',
      fontFamily: 'inherit',
    });

    const decoded = decodeURIComponent(props.code);
    const { svg } = await mermaid.render(uniqueRenderId, decoded);

    // Ensure we only update if this was the latest render request
    if (currentSeq === renderSeq) {
      svgHtml.value = svg;
      error.value = '';
    }
  } catch (err: unknown) {
    console.error('Mermaid render error:', err);
    if (currentSeq === renderSeq) {
      error.value = err instanceof Error ? err.message : String(err);
    }
    // Clean up temporary DOM nodes inserted by Mermaid on failure
    const leftoverEl = document.getElementById(`d${uniqueRenderId}`);
    if (leftoverEl) {
      leftoverEl.remove();
    }
  }
}

onMounted(async () => {
  await renderDiagram();
});

watch(isDark, async () => {
  await renderDiagram();
});

watch(
  () => props.code,
  async () => {
    await renderDiagram();
  }
);
</script>

<style scoped>
.mermaid-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 1.5rem 0;
  padding: 1.25rem;
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: var(--docs-radius-lg);
  overflow-x: auto;
  transition: background-color 0.25s, border-color 0.25s;
}

.mermaid-diagram {
  width: 100%;
  display: flex;
  justify-content: center;
}

.mermaid-diagram :deep(svg) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

.mermaid-error {
  color: var(--vp-c-danger-1);
  font-size: 0.9rem;
  width: 100%;
}

.mermaid-error-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.mermaid-error-msg {
  background-color: var(--vp-c-bg-mute);
  padding: 0.75rem;
  border-radius: var(--docs-radius-md);
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-all;
}

.mermaid-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
  padding: 1rem 0;
}

.mermaid-spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--vp-c-border);
  border-top-color: var(--vp-c-brand-1);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mermaid-spinner {
    animation: none;
  }
}
</style>
