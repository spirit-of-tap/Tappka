import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import HtmlShim from './HtmlShim.vue';
import Mermaid from './Mermaid.vue';

import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HtmlShim', HtmlShim);
    app.component('Mermaid', Mermaid);
  },
} satisfies Theme;
