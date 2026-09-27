// 固定模拟内容供组件目录和同类页面共同使用；不读取真实项目。
export const projects = [
  { id: 1, name: '客户服务工作台', type: '业务工作台', status: '进行中', owner: '林悦', progress: 68, description: '集中处理客户请求、跟进进度与服务记录。', date: '今天 10:30' },
  { id: 2, name: '团队知识中心', type: '知识管理', status: '已就绪', owner: '陈舟', progress: 100, description: '整理团队文档，让知识可查找、可复用。', date: '今天 09:15' },
  { id: 3, name: '运营数据看板', type: '运营分析', status: '待评审', owner: '林悦', progress: 42, description: '查看关键变化，跟进需要处理的问题。', date: '昨天 16:40' },
];
export const records = [
  { id: 101, name: '客户服务工作台', owner: '林悦', status: '进行中', entries: 128 },
  { id: 102, name: '团队知识中心', owner: '陈舟', status: '已就绪', entries: 356 },
  { id: 103, name: '运营数据看板', owner: '林悦', status: '待评审', entries: 82 },
  { id: 104, name: '订单管理后台', owner: '陈舟', status: '进行中', entries: 640 },
  { id: 105, name: '内容审核平台', owner: '林悦', status: '已就绪', entries: 215 },
  { id: 106, name: '数据导入中心', owner: '陈舟', status: '待评审', entries: 48 },
];
