(function (root) {
  'use strict';
  const colorKeys = ['canvas', 'surface', 'raised', 'line', 'text', 'muted', 'accent', 'onAccent', 'tint', 'danger', 'success'];
  const palette = values => Object.fromEntries(colorKeys.map((key, index) => [key, values[index]]));
  const libraries = {
    order: {
      name: '规整', subtitle: '精密工作台', icon: 'regular', layout: 'table', detail: 'drawer',
      description: '侧栏组织信息，表格集中处理，详情从侧边打开。',
      fit: ['数据管理', 'SaaS 工具', '客户管理'], avoid: '以情绪表达和大图浏览为主的产品。',
      shape: '4px 小圆角 · 细分隔线', motion: '160ms 快速侧滑', interaction: '侧边抽屉 · 单项展开',
      colors: [
        { id: 'indigo', name: '靛青', description: '冷静蓝调，突出关键操作与数据层级。', light: palette(['#f5f7fc','#ffffff','#eef1f8','#d4dbe8','#1c2940','#596a82','#435bd5','#ffffff','#e9edff','#b82d40','#26724b']), dark: palette(['#131925','#1a2232','#232e42','#394860','#e7edf8','#a1b0c8','#a9b9ff','#16213d','#283858','#ff9da9','#8fdaad']) },
        { id: 'slate', name: '岩灰', description: '低饱和灰绿，适合长时间处理业务。', light: palette(['#f4f6f5','#ffffff','#eaf0ed','#ccd8d1','#23362e','#5a6f64','#416851','#ffffff','#e6f0e9','#b43242','#226846']), dark: palette(['#151e19','#1e2b24','#283930','#415c4b','#e8f3eb','#a6bdae','#a4d1b1','#142f20','#2c4b36','#ffa6ae','#94ddb2']) }
      ]
    },
    ease: {
      name: '松弛', subtitle: '舒展内容空间', icon: 'fill', layout: 'cards', detail: 'modal',
      description: '顶部导航留出整幅空间，卡片承载内容，弹窗聚焦当前操作。',
      fit: ['知识管理', '内容管理', '个人效率'], avoid: '需要同屏查看大量明细或快速连续操作的控制台。',
      shape: '18px 大圆角 · 柔和层次', motion: '320ms 弹性缩放', interaction: '居中弹窗 · 多项展开',
      colors: [
        { id: 'clay', name: '陶土', description: '温暖纸色，适合阅读和内容整理。', light: palette(['#f5f0e9','#fffdf8','#eee5d9','#d9cabc','#3e302a','#7b665b','#994c32','#ffffff','#f6e1d5','#ae313c','#4b704e']), dark: palette(['#221c19','#302622','#3e3029','#634a3f','#f5e8df','#c2a89b','#efb391','#392015','#52392d','#ffa2a7','#b3d4a0']) },
        { id: 'sage', name: '鼠尾草', description: '轻柔绿调，让内容空间更舒展。', light: palette(['#eef3ed','#fbfdf9','#e1eadd','#c8d4c2','#28392b','#5f725e','#456d4c','#ffffff','#deeddc','#aa3741','#3c6a40']), dark: palette(['#192019','#252f25','#313e2f','#4a6147','#e8f2e4','#acbfa7','#bad9a4','#21371a','#3a5131','#ffaab0','#b4dfa8']) }
      ]
    },
    edge: {
      name: '棱角', subtitle: '紧凑任务控制台', icon: 'duotone', layout: 'split', detail: 'inline',
      description: '紧凑列表与详情并排，选择即查看，不必来回开关浮层。',
      fit: ['数据后台', '开发工具', '运营管理'], avoid: '强调柔和氛围、留白和长篇连续阅读的产品。',
      shape: '直角 · 明确边线', motion: '120ms 分段揭示', interaction: '主从分栏 · 就地展开',
      colors: [
        { id: 'ocean', name: '深海', description: '清晰蓝调，便于密集信息的定位。', light: palette(['#edf3f7','#fafdff','#e0ebf1','#b8ccda','#172f40','#47677a','#22658d','#ffffff','#d5e9f4','#b52e3e','#23704e']), dark: palette(['#101a22','#172631','#203643','#365766','#e0f0f9','#9ebcca','#83c8ee','#102b3c','#224859','#ffa0ae','#8edcb5']) },
        { id: 'amber', name: '琥珀', description: '暖金强调色，突出当前任务与反馈。', light: palette(['#f6f2e8','#fffdf5','#eee6d0','#d6c69d','#382f19','#756342','#8d5b17','#ffffff','#f6e8c2','#ac3042','#43692f']), dark: palette(['#211d13','#2d281b','#403821','#63552f','#f5edda','#c6b889','#ebcb75','#32250a','#504322','#ffa3ad','#b6d895']) }
      ]
    }
  };
  const items = [
    { id: 1, name: '客户服务工作台', type: '业务工作台', status: '进行中', owner: '林悦', progress: 68, description: '集中处理客户请求、跟进进度与服务记录。', date: '今天 10:30' },
    { id: 2, name: '团队知识中心', type: '知识管理', status: '已就绪', owner: '陈舟', progress: 100, description: '整理团队文档，让知识可查找、可复用。', date: '今天 09:15' },
    { id: 3, name: '运营数据看板', type: '运营分析', status: '待评审', owner: '林悦', progress: 42, description: '查看关键变化，跟进需要处理的问题。', date: '昨天 16:40' }
  ];
  const records = [
    { id: 101, name: '客户服务工作台', owner: '林悦', status: '进行中', entries: 128 },
    { id: 102, name: '团队知识中心', owner: '陈舟', status: '已就绪', entries: 356 },
    { id: 103, name: '运营数据看板', owner: '林悦', status: '待评审', entries: 82 },
    { id: 104, name: '订单管理后台', owner: '陈舟', status: '进行中', entries: 640 },
    { id: 105, name: '内容审核平台', owner: '林悦', status: '已就绪', entries: 215 },
    { id: 106, name: '数据导入中心', owner: '陈舟', status: '待评审', entries: 48 }
  ];
  class PreviewModel {
    constructor() {
      this.library = 'order'; this.colorChoices = { order: 'indigo', ease: 'clay', edge: 'ocean' }; this.mode = 'light';
      this.view = 'components'; this.scenario = 'normal'; this.name = '客户服务工作台'; this.sampleName = '团队知识中心'; this.invalidName = 'A';
      this.notify = true; this.priority = '普通'; this.error = ''; this.saving = false; this.saved = false; this.savedName = '';
      this.tableQuery = ''; this.tableStatus = 'all'; this.tableOwner = 'all'; this.tableSort = 'id'; this.tableDescending = false; this.tablePage = 1; this.pageSize = 3; this.selectedRows = new Set(); this.markedRows = new Set(); this.visibleColumns = new Set(['owner','entries']);
      this.department = '产品团队'; this.permissions = new Set(['查看']); this.delivery = '站内'; this.quantity = 10; this.threshold = 60; this.dateStart = '2026-09-01'; this.dateEnd = '2026-09-25'; this.notes = ''; this.fileName = ''; this.treeOpen = true; this.treeChoice = '产品团队'; this.step = 1; this.demoTab = 'overview'; this.metricPeriod = 'week';
      this.query = ''; this.filter = 'all'; this.selectedItem = 1; this.expanded = new Set(); this.recovered = false;
    }
    get color() { return this.colorChoices[this.library]; }
    get palette() { return libraries[this.library].colors.find(color => color.id === this.color)[this.mode]; }
    chooseLibrary(id) { if (Object.hasOwn(libraries, id)) { this.library = id; this.expanded.clear(); } }
    chooseColor(id) { if (libraries[this.library].colors.some(color => color.id === id)) this.colorChoices[this.library] = id; }
    chooseMode(mode) { if (['light', 'dark'].includes(mode)) this.mode = mode; }
    chooseView(view) { if (['components', 'layout', 'info'].includes(view)) this.view = view; }
    chooseScenario(scenario) { if (['normal', 'loading', 'empty', 'error'].includes(scenario)) this.scenario = scenario; }
    editName(value) { this.name = value; this.saved = false; if (value.trim()) this.error = ''; }
    beginSave() {
      if (this.saving) return false;
      if (!this.name.trim()) { this.error = '请填写项目名称。'; this.saved = false; return false; }
      this.error = ''; this.saving = true; this.saved = false; this.pendingName = this.name.trim(); return true;
    }
    finishSave() { if (this.saving) { this.savedName = this.pendingName; this.saving = false; this.saved = true; } }
    toggleExpand(id) {
      if (this.expanded.has(id)) this.expanded.delete(id);
      else { if (this.library !== 'ease') this.expanded.clear(); this.expanded.add(id); }
    }
    filteredRecords() {
      const rows = records.filter(row => `${row.name} ${row.owner}`.includes(this.tableQuery.trim()) && (this.tableStatus === 'all' || row.status === this.tableStatus) && (this.tableOwner === 'all' || row.owner === this.tableOwner));
      return rows.sort((a,b) => (typeof a[this.tableSort] === 'number' ? a[this.tableSort]-b[this.tableSort] : a[this.tableSort].localeCompare(b[this.tableSort],'zh-CN')) * (this.tableDescending ? -1 : 1));
    }
    get tablePages() { return Math.max(1, Math.ceil(this.filteredRecords().length / this.pageSize)); }
    pageRecords() { this.tablePage = Math.min(this.tablePage, this.tablePages); return this.filteredRecords().slice((this.tablePage-1)*this.pageSize, this.tablePage*this.pageSize); }
    sortTable(key) { if (['name','entries'].includes(key)) { this.tableDescending = this.tableSort === key ? !this.tableDescending : false; this.tableSort=key; this.tablePage=1; } }
    selectPage() { const ids=this.pageRecords().map(row=>row.id); if(ids.every(id=>this.selectedRows.has(id))) ids.forEach(id=>this.selectedRows.delete(id)); else ids.forEach(id=>this.selectedRows.add(id)); }
    markSelected() { this.selectedRows.forEach(id=>this.markedRows.add(id)); }
    get rangeError() { return this.dateStart && this.dateEnd && this.dateStart > this.dateEnd ? '结束日期不能早于开始日期。' : ''; }
    visibleItems() {
      if (this.scenario !== 'normal') return [];
      return items.filter(item => (this.filter === 'all' || (this.filter === 'ready' ? item.status === '已就绪' : item.status !== '已就绪')) && `${item.name} ${item.type} ${item.owner}`.includes(this.query.trim()));
    }
  }
  class GalleryModel {
    constructor() { this.filter='all'; this.positions=Object.fromEntries(Object.keys(libraries).map(key=>[key,0])); this.paused=new Set(); }
    visibleLibraries() { return Object.entries(libraries).filter(([,library])=>this.filter==='all'||library.fit.includes(this.filter)); }
    move(key,direction) { const count=libraries[key].colors.length;this.positions[key]=(this.positions[key]+direction+count)%count; }
    choose(key,index) { this.positions[key]=index; }
    color(key) { return libraries[key].colors[this.positions[key]]; }
  }
  const api = { PreviewModel, GalleryModel, libraries, items, records, colorKeys };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DesignPalPreview = api;
})(typeof window !== 'undefined' ? window : globalThis);
