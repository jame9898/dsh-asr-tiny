import assert from 'node:assert/strict'
import test from 'node:test'
import { joinDraft, normalizeAsrText } from '../lib/client/text.js'

test('normalizeAsrText collapses spaces between CJK characters', () => {
  assert.equal(normalizeAsrText('现 在 可 以 听 到 我 讲 话 吗'), '现在可以听到我讲话吗')
  assert.equal(normalizeAsrText('你 好 ， 今 天 天 气 怎 么 样 ？'), '你好，今天天气怎么样？')
})

test('normalizeAsrText keeps spaces around Latin words and digits', () => {
  assert.equal(normalizeAsrText('我 用 ChatGPT 写 代 码 123'), '我用 ChatGPT 写代码 123')
  assert.equal(normalizeAsrText('今天 的 会议 在 3 点 开始'), '今天的会议在 3 点开始')
})

test('normalizeAsrText leaves already-clean text untouched', () => {
  assert.equal(normalizeAsrText('呃，这个东西呢好像是有点还是有点大的。'), '呃，这个东西呢好像是有点还是有点大的。')
})

test('joinDraft returns the addition when the draft is empty', () => {
  assert.equal(joinDraft('', '你好'), '你好')
  assert.equal(joinDraft('   ', '你好'), '你好')
})

test('joinDraft joins CJK tightly and Latin with a space', () => {
  assert.equal(joinDraft('今天天气不错。', '我们去公园吧。'), '今天天气不错。我们去公园吧。')
  assert.equal(joinDraft('hello', 'world'), 'hello world')
  assert.equal(joinDraft('hello', '你好'), 'hello 你好')
  assert.equal(joinDraft('你好', 'hello'), '你好 hello')
})

test('joinDraft trims trailing whitespace before appending', () => {
  assert.equal(joinDraft('你好  ', '世界'), '你好世界')
})
