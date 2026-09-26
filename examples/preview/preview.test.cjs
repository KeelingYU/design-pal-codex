const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PreviewModel, libraries, items, colorKeys } = require('./preview-model.js');

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) { const values = [luminance(a), luminance(b)].sort((x,y)=>y-x); return (values[0]+.05)/(values[1]+.05); }

test('预览预设为 3 库、每库 2 色、每色亮暗，共 12 个完整颜色组合', () => {
  assert.equal(Object.keys(libraries).length, 3); let count = 0;
  for (const library of Object.values(libraries)) {
    assert.equal(library.colors.length, 2);
    for (const color of library.colors) for (const mode of ['light', 'dark']) {
      assert.deepEqual(Object.keys(color[mode]), colorKeys);
      for (const value of Object.values(color[mode])) assert.match(value, /^#[0-9a-f]{6}$/i);
      count++;
    }
  }
  assert.equal(count, 12);
});

test('12 个组合的正文、说明与主按钮文字均达到普通文字的最低对比度', () => {
  for (const [key, library] of Object.entries(libraries)) for (const color of library.colors) for (const mode of ['light','dark']) {
    const palette = color[mode];
    for (const surface of ['surface','canvas']) {
      assert.ok(contrast(palette.text,palette[surface]) >= 4.5, `${key}/${color.id}/${mode} 正文`);
      assert.ok(contrast(palette.muted,palette[surface]) >= 4.5, `${key}/${color.id}/${mode} 说明`);
    }
    assert.ok(contrast(palette.onAccent,palette.accent) >= 4.5, `${key}/${color.id}/${mode} 按钮`);
  }
});

test('切换颜色与亮暗保持当前库、交互状态、输入、筛选及详情选择', () => {
  const preview = new PreviewModel(); preview.editName('验收项目'); preview.query = '客户'; preview.filter = 'pending'; preview.selectedItem = 3;
  for (const [key, library] of Object.entries(libraries)) {
    preview.chooseLibrary(key); preview.toggleExpand('scope');
    for (const color of library.colors) for (const mode of ['light','dark']) {
      preview.chooseColor(color.id); preview.chooseMode(mode);
      assert.equal(preview.library, key); assert.equal(preview.name, '验收项目');
      assert.equal(preview.query, '客户'); assert.equal(preview.filter, 'pending'); assert.equal(preview.selectedItem, 3);
      assert.ok(preview.expanded.has('scope')); assert.deepEqual(preview.palette,color[mode]);
    }
  }
});

test('切换库后记住各库之前的配色，同时保留亮暗模式', () => {
  const preview = new PreviewModel(); preview.chooseColor('slate'); preview.chooseMode('dark');
  preview.chooseLibrary('ease'); preview.chooseColor('sage'); preview.chooseLibrary('order');
  assert.equal(preview.color, 'slate'); assert.equal(preview.mode,'dark');
  preview.chooseLibrary('ease'); assert.equal(preview.color,'sage');
});

test('三个库采用不同布局、详情交互与图标；颜色对象不含结构设置', () => {
  for (const key of ['layout','detail','icon']) assert.equal(new Set(Object.values(libraries).map(library=>library[key])).size,3);
  for (const library of Object.values(libraries)) for (const color of library.colors) assert.deepEqual(Object.keys(color),['id','name','description','light','dark']);
});

test('松弛允许多项展开，规整与棱角一次只展开一项，均能再次收起', () => {
  const preview = new PreviewModel();
  for (const library of Object.keys(libraries)) {
    preview.chooseLibrary(library); preview.toggleExpand('scope'); preview.toggleExpand('usage');
    assert.equal(preview.expanded.size,library==='ease'?2:1);
    assert.ok(preview.expanded.has('usage')); preview.toggleExpand('usage'); assert.equal(preview.expanded.has('usage'),false);
  }
});

test('空名称不保存，修正后允许保存并拒绝加载中重复提交', () => {
  const preview = new PreviewModel(); preview.editName(' '); assert.equal(preview.beginSave(),false); assert.ok(preview.error);
  preview.editName(' 新项目 '); assert.equal(preview.error,''); assert.equal(preview.beginSave(),true); assert.equal(preview.beginSave(),false);
  preview.chooseLibrary('ease'); preview.chooseColor('sage'); preview.chooseMode('dark'); preview.finishSave();
  assert.equal(preview.savedName,'新项目'); assert.equal(preview.saved,true); assert.equal(preview.saving,false);
});

test('筛选与搜索在同一数据集生效，跨库可对照同样结果', () => {
  const preview = new PreviewModel(); preview.query='林悦'; preview.filter='pending';
  for (const library of Object.keys(libraries)) { preview.chooseLibrary(library); assert.deepEqual(preview.visibleItems().map(item=>item.id),[1,3]); }
  preview.query='不存在'; assert.equal(preview.visibleItems().length,0);
  preview.query=''; preview.filter='all'; assert.deepEqual(preview.visibleItems(),items);
});

test('页面异常状态恢复后保留原筛选，不会影响组件样例数据', () => {
  const preview = new PreviewModel(); preview.filter='ready'; preview.name='保存的内容';
  for (const state of ['loading','empty','error']) { preview.chooseScenario(state); assert.deepEqual(preview.visibleItems(),[]); assert.equal(preview.name,'保存的内容'); }
  preview.chooseScenario('normal'); assert.deepEqual(preview.visibleItems().map(item=>item.id),[2]);
});

test('首页卡片具备适用类型及前两色简介，可定位六个独立预览', () => {
  const paths=[];
  for(const [key,library] of Object.entries(libraries)) {
    assert.ok(library.description);assert.ok(library.fit.length>=2);
    for(const color of library.colors.slice(0,2)){assert.ok(color.description);paths.push(`${key}-${color.id}`);}
  }
  assert.equal(new Set(paths).size,6);
});

test('数据表排序后按页取数，翻页无重复或遗漏', () => {
  const preview=new PreviewModel();preview.sortTable('entries');
  assert.deepEqual(preview.pageRecords().map(row=>row.entries),[48,82,128]);
  preview.tablePage=2;assert.deepEqual(preview.pageRecords().map(row=>row.entries),[215,356,640]);
  preview.sortTable('entries');assert.deepEqual(preview.pageRecords().map(row=>row.entries),[640,356,215]);
});

test('数据表组合筛选和搜索生效，缩小结果后自动回到有效页', () => {
  const preview=new PreviewModel();preview.tablePage=2;preview.tableStatus='进行中';preview.tableOwner='陈舟';
  assert.deepEqual(preview.pageRecords().map(row=>row.name),['订单管理后台']);assert.equal(preview.tablePage,1);
  preview.tableQuery='不存在';assert.deepEqual(preview.pageRecords(),[]);assert.equal(preview.tablePages,1);
});

test('全选仅作用于当前页，跨页选择和批量标记不影响其他记录', () => {
  const preview=new PreviewModel();preview.selectPage();assert.deepEqual([...preview.selectedRows],[101,102,103]);
  preview.tablePage=2;preview.selectPage();assert.equal(preview.selectedRows.size,6);
  preview.selectPage();assert.deepEqual([...preview.selectedRows],[101,102,103]);
  preview.markSelected();assert.deepEqual([...preview.markedRows],[101,102,103]);
  preview.chooseLibrary('ease');preview.chooseColor('sage');preview.chooseMode('dark');assert.equal(preview.markedRows.size,3);
});

test('日期范围拒绝结束早于开始，修正后清除错误', () => {
  const preview=new PreviewModel();preview.dateStart='2026-09-26';preview.dateEnd='2026-09-25';assert.ok(preview.rangeError);
  preview.dateEnd='2026-09-26';assert.equal(preview.rangeError,'');
});

test('产品类型筛选只显示匹配库，恢复全部不丢失各卡片配色', () => {
  const { GalleryModel }=require('./preview-model.js');const gallery=new GalleryModel();
  gallery.move('order',1);gallery.filter='SaaS 工具';assert.deepEqual(gallery.visibleLibraries().map(([key])=>key),['order']);
  gallery.filter='知识管理';assert.deepEqual(gallery.visibleLibraries().map(([key])=>key),['ease']);
  gallery.filter='all';assert.equal(gallery.visibleLibraries().length,3);assert.equal(gallery.color('order').id,'slate');
});

test('配色轮播可前后循环，圆点直达且各库互不影响', () => {
  const { GalleryModel }=require('./preview-model.js');const gallery=new GalleryModel();
  gallery.move('order',-1);assert.equal(gallery.color('order').id,'slate');gallery.move('order',1);assert.equal(gallery.color('order').id,'indigo');
  gallery.choose('ease',1);assert.equal(gallery.color('ease').id,'sage');assert.equal(gallery.color('edge').id,'ocean');
});

test('库说明可作为独立主页面，切回预览保留当前颜色和表单', () => {
  const preview=new PreviewModel();preview.editName('保留的输入');preview.chooseColor('slate');preview.chooseView('info');assert.equal(preview.view,'info');
  preview.chooseView('components');assert.equal(preview.name,'保留的输入');assert.equal(preview.color,'slate');
});
