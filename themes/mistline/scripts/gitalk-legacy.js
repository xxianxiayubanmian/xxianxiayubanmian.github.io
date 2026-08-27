'use strict';

/* Gitalk 评论 id 兼容层：
 * 旧博客以 hexo-abbrlink 生成的 hex 值作为 Gitalk issue 的 id，
 * 这里从 legacy-map.json（旧站部署产物解析而来）恢复映射，
 * 让新文章沿用旧 issue，历史评论不丢失；未收录的文章回退为 slug。
 * 同时保留旧的 abbrlink 跳转页，外部旧链接仍然可达。 */

const fs = require('fs');
const path = require('path');

const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'legacy-map.json'), 'utf8'));

const slugOf = (post) => {
  const seg = String(post.path || '').split('/').filter(Boolean);
  return seg.length >= 2 ? seg[1] : (seg[0] || '');
};

hexo.extend.filter.register('before_post_render', function (data) {
  if (data.layout === 'post') {
    const entry = Object.entries(map).find(([, v]) => v.slug === slugOf(data));
    data.gitalkId = entry ? entry[0] : slugOf(data);
  }
  return data;
});

hexo.extend.helper.register('legacy_gitalk_id', function (post) {
  const slug = slugOf(post);
  const entry = Object.entries(map).find(([, v]) => v.slug === slug);
  return entry ? entry[0] : slug;
});

hexo.extend.generator.register('legacy_abbrlink_redirects', function () {
  return Object.entries(map).map(([hex, v]) => ({
    path: `${hex}.html`,
    data: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0; url=${v.path}">
  <title>${v.title || 'Redirecting'}</title>
</head>
<body>
  <p>This page has moved to <a href="${v.path}">${v.path}</a>.</p>
  <script>location.replace(${JSON.stringify(v.path)});</script>
</body>
</html>`,
  }));
});
