// 所有数据与操作均为虚构；不连接模型、项目、账户或业务服务。
export function createTasks() {
  let tasks = [
    { id: '1', name: '整理虚构会议纪要', status: '待开始', result: '尚无模拟结果' },
    { id: '2', name: '检查示例文案', status: '已完成', result: '模拟结果：文案检查完成' },
    { id: '3', name: '归纳虚构资料', status: '待开始', result: '尚无模拟结果' },
    { id: '4', name: '生成模拟周报', status: '已取消', result: '模拟任务已取消' },
    { id: '5', name: '比较示例方案', status: '待开始', result: '尚无模拟结果' },
    { id: '6', name: '整理模拟待办', status: '已完成', result: '模拟结果：待办整理完成' },
  ];
  return {
    list: () => tasks.map(task => ({ ...task })),
    get: id => ({ ...tasks.find(task => task.id === id) }),
    save(id, name) {
      if (!name.trim()) throw new Error('请填写任务名称');
      tasks = tasks.map(task => task.id === id ? { ...task, name: name.trim() } : task);
    },
    transition(id, action) {
      const task = tasks.find(task => task.id === id);
      if (!task) throw new Error('任务不存在');
      const transitions = { start: ['待开始', '进行中'], complete: ['进行中', '已完成'] };
      if (action === 'cancel' && ['待开始', '进行中'].includes(task.status)) {
        task.status = '已取消'; task.result = '模拟任务已取消';
      } else if (transitions[action]?.[0] === task.status) {
        task.status = transitions[action][1];
        task.result = action === 'complete' ? '模拟结果：任务完成，未执行真实模型' : '模拟进度：任务进行中';
      } else throw new Error('当前状态不能执行此操作');
    },
  };
}
