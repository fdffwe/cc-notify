'use strict';

const test = require('node:test');
const assert = require('node:assert');
const config = require('../src/config');

test('render 替换变量', () => {
  assert.strictEqual(config.render('{{tool}} 需要确认', { tool: 'Bash' }), 'Bash 需要确认');
});

test('render 未提供的变量替换为空串', () => {
  assert.strictEqual(config.render('[{{missing}}]', {}), '[]');
});

test('render 支持一个模板里多个变量', () => {
  const out = config.render('{{a}}-{{b}}-{{a}}', { a: '1', b: '2' });
  assert.strictEqual(out, '1-2-1');
});

test('render 不把正则特殊字符当语法', () => {
  assert.strictEqual(config.render('价格 100$ * {{tool}}', { tool: 'Bash' }), '价格 100$ * Bash');
});

test('merge 在无用户配置时给出默认值', () => {
  const merged = config.merge(null);
  assert.strictEqual(merged.events.permission.title, 'Claude Code 需要确认');
  assert.strictEqual(merged.events.stop.body, '任务完成');
});

test('merge 允许用户按字段覆盖，未覆盖的保留默认', () => {
  const merged = config.merge({ events: { permission: { body: '要用 {{tool}} 了' } } });
  assert.strictEqual(merged.events.permission.body, '要用 {{tool}} 了');
  assert.strictEqual(merged.events.permission.title, 'Claude Code 需要确认');
  assert.strictEqual(merged.events.stop.body, '任务完成');
});

test('merge 允许用户关闭某个事件', () => {
  const merged = config.merge({ events: { stop: { enabled: false } } });
  assert.strictEqual(merged.events.stop.enabled, false);
});
