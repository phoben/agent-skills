import { createHash } from 'node:crypto';
import { ProofError, requireValue } from '../errors.mjs';
import { IMAGE_MAX_BYTES, IMAGE_MIME_TYPES, imageReferences, normalizeImageUrl } from '../image-policy.mjs';

const keyPattern = /^[a-f0-9]{20}$/;
const sameIdentity = (left, right) => String(left) === String(right);

export function createIssueImages({ github, issues, now = () => new Date().toISOString() } = {}) {
  async function verify(fingerprint, identity) {
    requireValue(await github.fingerprint() === fingerprint, 'IDENTITY_CHANGED', 'GitHub凭据已变化，旧图片已停止读取。');
    const current = await issues.context();
    requireValue(sameIdentity(current.account?.id, identity), 'IDENTITY_CHANGED', 'GitHub账号已变化，旧图片已停止读取。');
    requireValue(!current.offline, 'IMAGE_UNAVAILABLE', '当前无法核对图片权限，请稍后重试或打开原图。');
    requireValue(await github.fingerprint() === fingerprint, 'IDENTITY_CHANGED', 'GitHub凭据正在变化，旧图片已停止读取。');
  }
  async function execute(payload) {
    requireValue(payload && typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).every(key => ['repositoryKey', 'number', 'url', 'commentId', 'expectedIdentity'].includes(key)), 'INVALID_ARGUMENT', '图片读取参数无效。');
    requireValue(keyPattern.test(payload.repositoryKey || '') && Number.isSafeInteger(payload.number) && payload.number > 0 && typeof payload.url === 'string' && payload.url.length <= 4096 && typeof payload.expectedIdentity === 'string' && payload.expectedIdentity.length > 0 && payload.expectedIdentity.length <= 256, 'INVALID_ARGUMENT', '图片归属或页面身份无效。');
    requireValue(payload.commentId === undefined || Number.isSafeInteger(payload.commentId) && payload.commentId > 0, 'INVALID_ARGUMENT', '图片评论标识无效。');
    const url = normalizeImageUrl(payload.url);
    requireValue(url, 'IMAGE_SOURCE_REJECTED', '此图片地址不支持安全预览，请打开原链接。');
    const fingerprint = await github.fingerprint();
    const readArgs = { repositoryKey: payload.repositoryKey, number: payload.number };
    // 不以离线/部分缓存替代当前仓库和Issue访问核对，不持久保存媒体字节。
    const summary = await issues.execute('read-summary', readArgs);
    requireValue(summary?.schemaVersion === 1 && sameIdentity(summary.identity, payload.expectedIdentity), 'IDENTITY_CHANGED', '页面账号已变化，图片未返回。');
    requireValue(summary.offline === false && summary.cached === false && summary.networkChecked === true, 'IMAGE_UNAVAILABLE', '详情尚未联网核对，暂不预览私有图片。');
    const issue = summary.data?.issue;
    requireValue(issue?.number === payload.number && typeof issue.body === 'string', 'IMAGE_UNAVAILABLE', 'Issue正文尚未读取，无法核对图片归属。');
    let source = issue.body;
    if (payload.commentId !== undefined) {
      let issueUrl;
      try { issueUrl = new URL(issue.url); } catch { /* 不从未知地址构造API路径。 */ }
      const match = issueUrl?.pathname.match(/^\/([A-Za-z0-9][A-Za-z0-9-]*)\/([A-Za-z0-9_.-]+)\/issues\/([1-9]\d*)\/?$/);
      requireValue(issueUrl?.origin === 'https://github.com' && !issueUrl.username && !issueUrl.password && !issueUrl.search && !issueUrl.hash && match && Number(match[3]) === payload.number, 'IMAGE_UNAVAILABLE', 'Issue来源尚未核实，无法读取评论图片。');
      const repository = `${match[1]}/${match[2]}`;
      try {
        const response = await github.request('GET', `/repos/${repository}/issues/comments/${payload.commentId}`);
        const comment = response.data;
        const expectedParent = `https://api.github.com/repos/${repository}/issues/${payload.number}`;
        requireValue(comment?.id === payload.commentId && typeof comment.body === 'string' && typeof comment.issue_url === 'string' && comment.issue_url.toLowerCase() === expectedParent.toLowerCase(), 'IMAGE_SOURCE_REJECTED', '此评论不属于当前Issue，图片未读取。');
        source = comment.body;
      } catch (error) {
        // 真实API失权交回Issue服务处理撤销；仅评论/附件不可读不假称整页离线。
        if (['AUTH_REQUIRED', 'PERMISSION_DENIED', 'NOT_FOUND'].includes(error?.code)) await issues.execute('read-summary', readArgs);
        await verify(fingerprint, summary.identity);
        if (error instanceof ProofError && ['IMAGE_SOURCE_REJECTED', 'AUTH_REQUIRED'].includes(error.code)) throw error;
        throw new ProofError('IMAGE_UNAVAILABLE', '评论图片暂时无法核实，请在GitHub查看。');
      }
    }
    requireValue(imageReferences(source).some(reference => reference.url === url), 'IMAGE_SOURCE_REJECTED', '图片不属于当前正文或评论，未代理读取。');
    await verify(fingerprint, summary.identity);
    let image;
    try { image = await github.readImage(url); }
    catch (error) {
      // 附件403/404不等于仓库失权；重新核对当前Issue后再保留局部图片错误。
      await issues.execute('read-summary', readArgs);
      await verify(fingerprint, summary.identity);
      if (error instanceof ProofError && /^IMAGE_/.test(error.code)) throw error;
      throw new ProofError('IMAGE_UNAVAILABLE', '图片暂时无法读取，请重试或打开原图。');
    }
    await verify(fingerprint, summary.identity);
    requireValue(Buffer.isBuffer(image?.bytes) && image.bytes.length > 0 && image.bytes.length <= IMAGE_MAX_BYTES, 'IMAGE_TOO_LARGE', '图片内容超出预览范围，请打开原图。');
    requireValue(IMAGE_MIME_TYPES.includes(image.mimeType), 'IMAGE_UNSUPPORTED', '此图片格式暂不支持预览，请打开原图。');
    const byteLength = image.bytes.length;
    const assetKey = createHash('sha256').update(url).digest('hex');
    return {
      envelope: { schemaVersion: 1, identity: summary.identity, sampledAt: now(), offline: false, cached: false, data: { mimeType: image.mimeType, byteLength, assetKey } },
      image: { mimeType: image.mimeType, byteLength, base64: image.bytes.toString('base64') },
    };
  }
  return { execute };
}
