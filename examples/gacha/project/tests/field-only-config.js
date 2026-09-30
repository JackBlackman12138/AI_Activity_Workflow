import { loadConfig, validateConfig } from '../src/config.js';

// I01 / R12：字段表属于未填写配置；明确填写错误类型的 rows 仍须报错。
export function testFieldOnlyConfig() {
  const fieldsOnly = { tables: { GachaToy: { fields: [{ key: 'toyId', type: 'string' }] } } };
  const config = loadConfig(fieldsOnly);
  if (config.toys.length !== 25 || validateConfig(config).length) {
    throw new Error('仅含 fields 的玩具表应回退到完整演示配置');
  }
  const malformed = loadConfig({ tables: { GachaToy: { fields: [], rows: 'invalid' } } });
  if (!validateConfig(malformed).some(message => message.includes('rows 不是数组'))) {
    throw new Error('明确填写但类型错误的 rows 不得静默回退');
  }
  return true;
}
