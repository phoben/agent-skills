import manifest from '../../../plugins/yg-toolkit/plugin.json' with { type: 'json' };

// 组件私有包版本不代表插件版本，源码与分发都以YG双清单为准。
export const VERSION = typeof __ISSUE_HUB_VERSION__ === 'string' ? __ISSUE_HUB_VERSION__ : manifest.version;
