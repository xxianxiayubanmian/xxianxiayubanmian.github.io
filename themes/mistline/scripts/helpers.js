/* Mistline 主题辅助函数与搜索索引生成器 */

const stripHtmlHelper = hexo.extend.helper.get('strip_html');
const stripHtml = (s) => {
  const value = String(s || '');
  return typeof stripHtmlHelper === 'function' ? stripHtmlHelper(value) : value.replace(/<[^>]+>/g, '');
};

/** 提取纯文本并截断，用于列表摘要 */
hexo.extend.helper.register('plain_text', function (content, limit) {
  limit = limit || 120;
  const text = stripHtml(content).replace(/\s+/g, ' ').trim();
  return text.length > limit ? text.slice(0, limit) + '…' : text;
});

/** 粗略阅读时长：按每分钟 400 字符估算，最少 1 分钟 */
hexo.extend.helper.register('reading_min', function (content) {
  const n = stripHtml(content).replace(/\s+/g, '').length;
  return Math.max(1, Math.round(n / 400));
});

/**
 * 生成 /search.json —— 全站文章索引，供前端无后端搜索使用。
 * 返回字段：title / url / date / tags / text
 */
hexo.extend.generator.register('mistline-search-index', function (locals) {
  const trim = (arr) => (arr || []).map((item) => item.name);

  const docs = locals.posts.sort('date', -1).map((post) => ({
    title: post.title || '无题',
    url: '/' + post.path,
    date: post.date.format('YYYY-MM-DD'),
    tags: trim(post.tags && post.tags.data),
    text: stripHtml(post.excerpt || post.content).replace(/\s+/g, ' ').slice(0, 200),
  }));

  return { path: 'search.json', data: JSON.stringify(docs) };
});
