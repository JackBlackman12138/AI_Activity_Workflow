import { defaultTables } from '../src/defaults.js';
import { loadConfig, validateConfig, getSequenceShares } from '../src/config.js';

// R02/R04/R05：配置边界规则测试；无需主线玩法或网络。
export function testConfigEdgeCases() {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const originalRooms = defaultTables.GachaSequence;
  const extended = originalRooms.map((room, index) => index === 0 ? {
    ...room,
    orderedRewardsJson: JSON.stringify([
      ...JSON.parse(room.orderedRewardsJson),
      ...Array(20000).fill('G02')
    ])
  } : room);
  const longConfig = loadConfig({ tables: { GachaSequence: { rows: extended } } });
  assert(validateConfig(longConfig).length === 0, '长序列应仍为有效配置');
  const shares = getSequenceShares(longConfig, 'DEFAULT');
  const rare = shares.find(item => item.rewardId === 'G03');
  assert(rare?.count === 1 && rare.percentage > 0 && rare.displayValue !== '0.00%',
    '出现一次的非零玩具不得显示为0.00%');
  assert(Math.abs(shares.reduce((sum, item) => sum + item.percentage, 0) - 100) < 1e-7,
    '同一显示精度下，实际投放项占比须合计100%');
  assert(getSequenceShares(loadConfig(), 'DEFAULT')[0].displayValue === '8.33%',
    '默认60项序列的既有两位展示不得改变');

  const secondLayer = {
    ...defaultTables.PlayerLayers[0], layerId: 'SECOND', sequenceGroup: 'SEQ_B'
  };
  const secondRooms = originalRooms.map(room => ({
    ...room, layerId: 'SECOND', sequenceGroup: 'SEQ_B'
  }));
  const tables = {
    PlayerLayers: { rows: [...defaultTables.PlayerLayers, secondLayer] },
    GachaSequence: { rows: [...originalRooms, ...secondRooms] }
  };
  const missing = validateConfig(loadConfig({ tables }));
  for (const source of ['ORDER_SETTLED', 'GENERATOR_OUTPUT']) {
    assert(missing.some(message => message.includes('分层 SECOND') && message.includes(source)),
      `缺少SECOND分层的${source}供券规则应在启动前报错`);
  }
  const completeRules = [
    ...defaultTables.SupplyRules,
    ...defaultTables.SupplyRules.map(rule => ({
      ...rule, ruleId: `${rule.ruleId}_SECOND`, tier: 'SECOND'
    }))
  ];
  assert(validateConfig(loadConfig({ tables: {
    ...tables, SupplyRules: { rows: completeRules }
  } })).length === 0, '两种来源各一条规则时第二分层应有效');
  const duplicate = validateConfig(loadConfig({ tables: {
    ...tables,
    SupplyRules: { rows: [...completeRules, {
      ...completeRules[2], ruleId: 'SECOND_ORDER_DUPLICATE'
    }] }
  } }));
  assert(duplicate.some(message => message.includes('分层 SECOND') &&
    message.includes('ORDER_SETTLED') && message.includes('当前 2 条')),
    '同一分层与来源配置两条规则应明确报错');
  return true;
}
