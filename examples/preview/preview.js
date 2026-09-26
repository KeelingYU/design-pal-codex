(function () {
  'use strict';
  const { PreviewModel, libraries, items } = window.DesignPalPreview;
  const model = new PreviewModel();
  const params = new URLSearchParams(location.search);
  model.chooseLibrary(params.get('library')); model.chooseColor(params.get('color')); model.chooseMode(params.get('mode')); model.chooseView(params.get('view'));
  if(params.get('capture')==='1'){model.chooseView('layout');document.body.classList.add('capture-mode');}
  const panel = document.getElementById('preview-panel');
  const dialog = document.getElementById('demo-dialog');
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  let toastTimer, inlineOpen = false, sectionObserver;
  const groups=[['buttons','按钮'],['fields','输入与选择'],['advanced-fields','高级表单'],['data-components','表格与筛选'],['navigation-components','导航与结构'],['metrics-components','指标与图表'],['overlay-components','弹层与提示'],['feedback','内容反馈'],['interactions','交互与动效']];
  let activeSection=groups.some(([id])=>id===location.hash.slice(1))?location.hash.slice(1):'buttons';

  function icon(name) {
    return window.DesignPalIcons[libraries[model.library].icon][name].replace('<svg ', '<svg class="icon" aria-hidden="true" focusable="false" ');
  }
  function paintAppearance() {
    for (const node of [panel, dialog, document.getElementById('confirm-dialog'), document.getElementById('toast')]) {
      node.dataset.library = model.library; node.dataset.mode = model.mode;
      for (const [key, value] of Object.entries(model.palette)) node.style.setProperty(`--${key}`, value);
    }
    document.querySelectorAll('[data-mode]').forEach(node => {
      if (node.tagName === 'BUTTON') node.setAttribute('aria-pressed', node.dataset.mode === model.mode);
    });
    document.querySelectorAll('[data-color-choice]').forEach(button=>{const selected=button.dataset.colorChoice===model.color;button.setAttribute('aria-selected',selected);button.tabIndex=selected?0:-1;});
    const url=new URL(location.href);url.searchParams.set('library',model.library);url.searchParams.set('color',model.color);url.searchParams.set('mode',model.mode);url.searchParams.set('view',model.view);if(model.view!=='components')url.hash='';history.replaceState(null,'',url);
  }
  function notify(message) {
    const toast = document.getElementById('toast'); toast.textContent = message; toast.hidden = true;
    requestAnimationFrame(() => { toast.hidden = false; });
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
  }
  function detail(item) {
    return `<div class="detail-content"><p class="detail-eyebrow">项目详情 / ${String(item.id).padStart(2,'0')}</p><h2>${item.name}</h2><p>${item.description}</p><dl><div><dt>负责人</dt><dd>${item.owner}</dd></div><div><dt>当前状态</dt><dd>${item.status}</dd></div><div><dt>项目类型</dt><dd>${item.type}</dd></div><div><dt>最近更新</dt><dd>${item.date}</dd></div></dl><p class="detail-eyebrow">完成进度 · ${item.progress}%</p><div class="progress"><span style="width:${item.progress}%"></span></div><p class="detail-note">模拟项目，用于比较组件库的详情查看方式。</p></div>`;
  }
  function showDetail(id) {
    const item = items.find(item => item.id === Number(id)); model.selectedItem = item.id;
    if (model.library === 'edge') {
      inlineOpen = true;
      if (model.view === 'layout') {
        document.getElementById('edge-detail').innerHTML = detail(item);
        document.querySelectorAll('[data-select-item]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.selectItem) === item.id));
      } else {
        document.getElementById('inline-detail').innerHTML = `<button class="btn secondary icon-btn close-inline" data-close-inline aria-label="关闭就地详情">${icon('x')}</button>${detail(item)}`;
        document.getElementById('inline-detail').hidden = false;
        document.querySelector('[data-action="detail"]').setAttribute('aria-expanded','true');
      }
      return;
    }
    dialog.innerHTML = `<button class="btn secondary icon-btn dialog-close" data-close aria-label="关闭详情">${icon('x')}</button><div id="dialog-title" class="detail-eyebrow">${model.library === 'order' ? '侧边详情' : '项目详情'}</div>${detail(item)}<div class="dialog-actions"><button class="btn secondary" data-close>返回预览</button></div>`;
    paintAppearance(); dialog.showModal();
  }
  function renderCatalog() {
    const lib = libraries[model.library];
    return `<div class="catalog-header"><div class="catalog-title"><h1>${lib.name}<span style="font-weight:400;margin-left:12px;font-size:13px;color:var(--muted)">组件总览</span></h1><p>${lib.subtitle}</p></div><span class="sample-tag">各状态并列展示 · 控件可操作</span></div><div class="catalog">
      <section class="catalog-section" id="buttons"><div class="section-head"><span class="section-number">01</span><h2>按钮</h2><p>主操作与次操作</p></div><div class="state-grid">
        ${[['normal','正常',''],['hover','悬停','is-hover'],['focus','焦点','is-focus'],['disabled','禁用',''],['loading','加载中','loading']].map(([state,label,style])=>`<div class="state-cell" data-component-state="${state}"><span class="state-label">${label}</span><button class="btn ${style}" ${['disabled','loading'].includes(state)?'disabled':''} data-action="sample-button">${state==='loading'?`<span class="spin">${icon('circle-notch')}</span>提交中`:`${icon('plus')}新建项目`}</button><br><button class="btn secondary ${style}" ${['disabled','loading'].includes(state)?'disabled':''} data-action="sample-button">${state==='loading'?'<span class="spin">'+icon('circle-notch')+'</span>处理中':'查看详情'}</button></div>`).join('')}
      </div></section>
      <section class="catalog-section" id="fields"><div class="section-head"><span class="section-number">02</span><h2>输入与选择</h2><p>直接输入，体验校验与反馈</p></div><form id="settings-form" novalidate><div class="field-grid">
        <div class="field"><label for="project-name">正常</label><input class="input" id="project-name" name="projectName" value="${escape(model.name)}" placeholder="填写项目名称" aria-label="项目名称" aria-describedby="name-error" aria-invalid="${Boolean(model.error)}" ${model.saving?'disabled':''}><p class="field-hint error" id="name-error" role="alert">${escape(model.error)}</p></div>
        <div class="field"><label for="filled-input">已填写</label><input class="input" id="filled-input" value="${escape(model.sampleName)}" aria-label="已填写示例"><p class="field-hint">可继续编辑</p></div>
        <div class="field"><label for="focus-input">焦点样例</label><input class="input is-focus" id="focus-input" value="焦点轮廓" readonly><p class="field-hint">展示轮廓，不抢占实际焦点</p></div>
        <div class="field"><label for="error-input">错误</label><input class="input" id="error-input" value="${escape(model.invalidName)}" aria-invalid="${model.invalidName.trim().length<2}" aria-describedby="error-hint"><p class="field-hint ${model.invalidName.trim().length<2?'error':'success'}" id="error-hint">${model.invalidName.trim().length<2?'至少输入 2 个字符。':'已修正，可以继续。'}</p></div>
        <div class="field"><label for="disabled-input">禁用</label><input class="input" id="disabled-input" value="此项暂不可编辑" disabled><p class="field-hint">不可操作</p></div>
      </div><div class="settings-line"><label class="toggle-label">接收通知<input class="switch" type="checkbox" role="switch" id="notifications" ${model.notify?'checked':''}></label><label class="toggle-label">关闭样例<input class="switch" type="checkbox" role="switch" id="off-switch"></label><label class="toggle-label">禁用样例<input class="switch" type="checkbox" role="switch" checked disabled></label><div class="choice-group" role="group" aria-label="优先级">${['低','普通','高'].map(priority=>`<button type="button" data-priority="${priority}" aria-pressed="${model.priority===priority}">${priority}</button>`).join('')}</div></div><div class="save-line"><button class="btn" type="submit" ${model.saving?'disabled aria-busy="true"':''}>${model.saving?'<span class="spin">'+icon('circle-notch')+'</span>保存中…':'保存设置'}</button><p role="status" id="save-message">${model.saved?`已保存“${escape(model.savedName)}”的演示设置。`:'仅用于本页体验'}</p></div></form></section>
      ${window.BackendPreview.render(model,icon)}
      <section class="catalog-section" id="feedback"><div class="section-head"><span class="section-number">08</span><h2>内容反馈</h2><p>正常、加载、空内容和失败同时可见</p></div><div class="feedback-grid">
        <article class="feedback-sample success" data-feedback="normal"><span class="state-label">正常</span><div class="feedback-title">${icon('check-circle')}内容已准备好</div><p>所有修改已保存，可以继续操作。</p><button class="btn ghost" data-action="message">查看消息反馈 ${icon('caret-right')}</button></article>
        <article class="feedback-sample" data-feedback="loading"><span class="state-label">加载中</span><div class="feedback-title"><span class="spin">${icon('circle-notch')}</span>正在加载内容</div><div class="skeleton"></div><div class="skeleton short"></div></article>
        <article class="feedback-sample" data-feedback="empty"><span class="state-label">空内容</span><div class="feedback-title">${icon('folder')}还没有项目</div><p>项目创建后会显示在这里。</p><button class="btn secondary" data-action="empty">试用新建提示</button></article>
        <article class="feedback-sample error" data-feedback="error"><span class="state-label">失败</span><div class="feedback-title" id="retry-title">${icon(model.recovered?'check-circle':'warning')}${model.recovered?'已恢复连接':'暂时无法加载'}</div><p id="retry-description">${model.recovered?'重试反馈已展示，其他状态保持可见。':'当前内容未丢失，可以重新尝试。'}</p><button class="btn secondary" data-action="retry">${model.recovered?'再次演示失败':'重新尝试'}</button></article>
      </div></section>
      <section class="catalog-section" id="interactions"><div class="section-head"><span class="section-number">09</span><h2>交互、图标与动效</h2><p>每个库有自己的操作节奏</p></div><div class="interaction-grid"><section class="interactive-sample"><h3>${model.library==='order'?'从侧边查看详情':model.library==='ease'?'居中查看详情':'就地展开详情'}</h3><button class="btn" data-action="detail" aria-expanded="${inlineOpen}">${icon('rows')}预览详情</button><p>${lib.interaction}，内容保持一致。</p><div id="inline-detail" class="inline-detail" ${inlineOpen?'':'hidden'}>${inlineOpen?`<button class="btn secondary icon-btn close-inline" data-close-inline aria-label="关闭就地详情">${icon('x')}</button>${detail(items.find(item=>item.id===model.selectedItem))}`:''}</div></section><section class="interactive-sample"><h3>${model.library==='ease'?'可同时展开多项':'一次聚焦一项'}</h3>${[['scope','包含哪些内容？','通用组件、颜色主题、亮暗模式与页面示例。'],['usage','适合什么场景？',lib.fit.join('、')+'。']].map(([id,title,body])=>`<div class="disclosure"><button data-expand="${id}" aria-expanded="${model.expanded.has(id)}" aria-controls="expand-${id}">${title}${icon('caret-right')}</button><div id="expand-${id}" class="disclosure-body" ${model.expanded.has(id)?'':'hidden'}>${body}</div></div>`).join('')}</section><section class="interactive-sample"><h3>${lib.icon==='regular'?'线性图标':lib.icon==='fill'?'实心图标':'双色图标'} · ${lib.motion}</h3><div class="icon-set" aria-label="图标风格样例">${['squares-four','folder','rows','check-circle','warning'].map(name=>icon(name)).join('')}</div><button class="btn secondary" data-action="replay">重播动效</button><div class="motion-sample" id="motion-sample">${icon('check-circle')}内容更新完成</div></section></div></section><p class="catalog-note">交互样稿 · 悬停与焦点列是对照样例，真实焦点由键盘或鼠标操作决定。正式组件库尚未发布。</p></div>`;
  }
  function nav(rail=false) {
    return `<nav class="workspace-nav" aria-label="项目筛选">${[['all','全部项目','squares-four'],['pending','待处理','rows'],['ready','已就绪','check-circle']].map(([key,label,glyph])=>`<button data-filter="${key}" aria-label="${label}" title="${label}" aria-pressed="${model.filter===key}">${icon(glyph)}${rail?'':label}</button>`).join('')}</nav>`;
  }
  function search() { return `<label class="search-box">${icon('magnifying-glass')}<input class="input" id="project-search" value="${escape(model.query)}" aria-label="搜索项目" placeholder="搜索项目或负责人"></label>`; }
  function pageFeedback() {
    const emptySearch = model.scenario==='normal';
    const title = emptySearch?'没有匹配的项目':model.scenario==='loading'?'正在加载项目':model.scenario==='empty'?'还没有项目':'项目暂时无法加载';
    return `<div class="page-feedback">${model.scenario==='loading'?`<span class="spin">${icon('circle-notch')}</span>`:icon(model.scenario==='error'?'warning':'folder')}<h2>${title}</h2><p>${model.scenario==='loading'?'保持加载状态供你检查。':emptySearch?'换个关键词，或清除筛选。':'当前为模拟状态，不会影响真实项目。'}</p>${model.scenario==='loading'?'':`<button class="btn secondary" data-action="restore-page">${emptySearch?'清除筛选':model.scenario==='error'?'重新加载':'查看示例项目'}</button>`}</div>`;
  }
  function renderPageContent() {
    const list = model.visibleItems();
    if (!list.length) return pageFeedback();
    if(model.library==='order') return `<div class="table-wrap"><table class="project-table"><thead><tr><th>项目</th><th>状态</th><th>负责人</th><th>进度</th><th>操作</th></tr></thead><tbody>${list.map(item=>`<tr><td><div class="project-title">${icon('folder')}<div>${item.name}<small>${item.type}</small></div></td><td><span class="tag">${item.status}</span></td><td>${item.owner}</td><td><span style="font-size:11px">${item.progress}%</span></td><td><button class="btn secondary" data-item="${item.id}" aria-label="查看${item.name}">查看详情</button></td></tr>`).join('')}</tbody></table></div>`;
    if(model.library==='ease') return `<div class="project-cards">${list.map(item=>`<article class="project-card"><div class="card-top">${icon('folder')}<span class="tag">${item.status}</span></div><h2>${item.name}</h2><p>${item.description}</p><div class="card-footer"><span>${item.owner}</span><button class="btn ghost" data-item="${item.id}" aria-label="查看${item.name}">打开项目 ${icon('caret-right')}</button></div></article>`).join('')}</div>`;
    const selected = list.find(item=>item.id===model.selectedItem) || list[0];
    return `<div class="edge-split"><div class="edge-list" aria-label="项目列表">${list.map(item=>`<button data-select-item="${item.id}" aria-label="查看${item.name}" aria-pressed="${item.id===selected.id}"><strong>${item.name}${icon('caret-right')}</strong><small>${item.type} · ${item.owner}</small><small><span class="tag">${item.status}</span></small></button>`).join('')}</div><section class="edge-detail" id="edge-detail" aria-label="就地项目详情">${detail(selected)}</section></div>`;
  }
  function renderPage() {
    const header = `<div class="workspace-head"><div><h1>项目管理</h1><p>相同项目，不同的组织与操作方式。</p></div>${search()}</div>`;
    const summary = `<div class="work-summary"><span>项目总数 <strong>03</strong></span><span>需要处理 <strong>02</strong></span><span id="result-count">当前显示 ${model.visibleItems().length} 项</span></div>`;
    if(model.library==='order')return `<div class="workbench order-workspace" data-page-layout="table"><aside class="order-sidebar"><div class="workspace-name">${icon('squares-four')}工作空间</div>${nav()}</aside><section class="order-main">${header}${summary}<div id="page-content">${renderPageContent()}</div></section></div>`;
    if(model.library==='ease')return `<div class="workbench ease-workspace" data-page-layout="cards"><div class="ease-top"><div class="workspace-name">${icon('squares-four')}工作空间</div>${nav()}</div>${header}${summary}<div id="page-content">${renderPageContent()}</div></div>`;
    return `<div class="workbench edge-workspace" data-page-layout="split"><aside class="edge-rail"><span class="rail-brand">${icon('squares-four')}</span>${nav(true)}</aside><section class="edge-main">${header}${summary}<div id="page-content">${renderPageContent()}</div></section></div>`;
  }
  function highlightSection(id) {
    activeSection=id;
    document.querySelectorAll('[data-section]').forEach(button=>{if(button.dataset.section===id)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');});
  }
  function renderSidebar() {
    const sidebar=document.getElementById('detail-sidebar');
    document.querySelector('.detail-shell').classList.toggle('no-sidebar',model.view==='info');
    sidebar.hidden=model.view==='info';
    if(model.view==='components') sidebar.innerHTML='<p>组件分组</p><nav aria-label="组件分组">'+groups.map(([id,name])=>`<button data-section="${id}">${name}</button>`).join('')+'</nav>';
    else if(model.view==='layout')sidebar.innerHTML='<p>页面状态</p><nav aria-label="页面状态">'+[['normal','正常'],['loading','加载中'],['empty','空内容'],['error','失败']].map(([id,name])=>`<button data-scenario="${id}" aria-pressed="${model.scenario===id}">${name}</button>`).join('')+'</nav>';
    else sidebar.innerHTML='';
    highlightSection(activeSection);
  }
  function render() {
    const lib=libraries[model.library];
    document.getElementById('current-library').textContent=lib.name+' / '+lib.subtitle;
    document.getElementById('color-tabs').innerHTML=lib.colors.map(color=>`<button role="tab" data-color-choice="${color.id}" aria-controls="preview-panel"><i style="background:${color.light.accent}"></i>${color.name}</button>`).join('');
    document.querySelectorAll('[data-view]').forEach(button=>{const selected=button.dataset.view===model.view;button.setAttribute('aria-selected',selected);button.tabIndex=selected?0:-1;});
    panel.setAttribute('aria-labelledby',`tab-${model.view}`);
    panel.innerHTML=model.view==='components'?renderCatalog():model.view==='layout'?renderPage():renderInfo();
    renderSidebar();paintAppearance();updateSelectionState();
    sectionObserver?.disconnect();
    if(model.view==='components'){
      sectionObserver=new IntersectionObserver(entries=>{const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);if(visible.length)highlightSection(visible[0].target.id);},{rootMargin:'-120px 0px -55% 0px'});
      panel.querySelectorAll('.catalog-section').forEach(section=>sectionObserver.observe(section));
    }
  }
  function renderInfo() {
    const lib=libraries[model.library];
    return `<article class="guide-content"><h1>${lib.name} · ${lib.subtitle}</h1><p>${lib.description}</p><h3>适用产品类型</h3><div class="product-type-tags">${lib.fit.map(tag=>`<span>${tag}</span>`).join('')}</div><h3>不适合直接采用</h3><p>${lib.avoid}</p><table><tbody><tr><th>组件形状</th><td>${lib.shape}</td></tr><tr><th>交互</th><td>${lib.interaction}</td></tr><tr><th>动效</th><td>${lib.motion}</td></tr><tr><th>颜色主题</th><td>${lib.colors.map(c=>c.name).join('、')}，各有亮色／暗色模式</td></tr></tbody></table><h3>交付范围</h3><p>正式交付为 3 个组件库，每库 2 套配色，每套配色都有亮暗模式，共 12 种组合。当前仍是交互样稿；正式组件、Agent 接入、版本隔离和下游复现尚未完成。</p><h3>试用说明</h3><p>组件状态并列展示；切换配色只改变颜色。页面预览使用同一组项目数据。所有操作仅保留在本页，刷新后重置。</p><p style="margin-top:18px;font-size:11px">图标使用 Phosphor Icons，许可与来源随样稿保存。</p></article>`;
  }
  function updateSelectionState() {
    const input=document.getElementById('select-page');if(!input)return;
    const rows=model.pageRecords();input.indeterminate=rows.some(row=>model.selectedRows.has(row.id))&&!rows.every(row=>model.selectedRows.has(row.id));
  }
  function refreshTable(preserveTools=false) {
    const active=document.activeElement,id=active?.id,sort=active?.dataset.tableSort,page=active?.dataset.tablePage;
    const cursor=active?.tagName==='INPUT'&&active.type==='text'?active.selectionStart:null;
    const markup=window.BackendPreview.table(model,icon);
    if(preserveTools){const fragment=document.createElement('div');fragment.innerHTML=markup;for(const selector of ['.batch-bar','.table-wrap','.pagination'])document.querySelector('#admin-table '+selector).replaceWith(fragment.querySelector(selector));}
    else document.getElementById('admin-table').innerHTML=markup;
    updateSelectionState();
    const target=id?document.getElementById(id):sort?document.querySelector(`[data-table-sort="${sort}"]`):page?document.querySelector(`[data-table-page="${page}"]`):null;
    if(target){target.focus({preventScroll:true});if(cursor!==null&&target.setSelectionRange)target.setSelectionRange(cursor,cursor);}
  }
  function refreshDemoTab() {
    document.querySelectorAll('[data-demo-tab]').forEach(button=>{const active=button.dataset.demoTab===model.demoTab;button.setAttribute('aria-selected',active);button.tabIndex=active?0:-1;});
    const target=document.getElementById('demo-tab-panel');target.setAttribute('aria-labelledby','demo-tab-'+model.demoTab);target.innerHTML=window.BackendPreview.tabContent(model);
  }
  function handleBackend(action,button) {
    if(action==='reset-table'){model.tableQuery='';model.tableStatus='all';model.tableOwner='all';model.tablePage=1;refreshTable();}
    else if(action==='clear-selection'){model.selectedRows.clear();refreshTable();}
    else if(action==='mark-rows'){model.markSelected();refreshTable();notify(`已标记 ${model.selectedRows.size} 条演示记录。`);}
    else if(action==='toggle-tree'){model.treeOpen=!model.treeOpen;button.setAttribute('aria-expanded',model.treeOpen);document.getElementById('tree-children').hidden=!model.treeOpen;}
    else if(action==='breadcrumb')document.getElementById('breadcrumb-result').textContent='当前路径：'+button.dataset.path;
    else if(action==='remove-file'){model.fileName='';document.getElementById('sample-file').value='';document.getElementById('file-info').textContent='尚未选择文件';}
    else if(action==='confirm'){paintAppearance();document.getElementById('confirm-dialog').showModal();}
    else if(action==='cancel-confirm')document.getElementById('confirm-dialog').close();
    else if(action==='accept-confirm'){document.getElementById('confirm-result').textContent='已确认归档演示，真实数据未改变。';document.getElementById('confirm-dialog').close();}
  }
  function handleBackendInput(input) {
    if(input.id==='table-search'){model.tableQuery=input.value;model.tablePage=1;refreshTable(true);}
    else if(input.id==='notes'){model.notes=input.value;document.getElementById('notes-count').textContent=input.value.length;}
    else if(input.id==='quantity'){model.quantity=input.value;document.getElementById('quantity-hint').textContent=input.validity.valid?'范围 1～99':'请输入 1～99 之间的数量。';}
    else if(input.id==='threshold'){model.threshold=Number(input.value);document.getElementById('threshold-value').textContent=input.value+'%';}
    else return false;
    return true;
  }
  function handleBackendChange(node) {
    if(node.id==='table-status'||node.id==='table-owner'){model[node.id==='table-status'?'tableStatus':'tableOwner']=node.value;model.tablePage=1;refreshTable();}
    else if(node.id==='page-size'){model.pageSize=Number(node.value);model.tablePage=1;refreshTable();}
    else if(node.id==='select-page'){model.selectPage();refreshTable();}
    else if(node.dataset.rowId){const id=Number(node.dataset.rowId);if(node.checked)model.selectedRows.add(id);else model.selectedRows.delete(id);refreshTable();}
    else if(node.dataset.column){if(node.checked)model.visibleColumns.add(node.dataset.column);else model.visibleColumns.delete(node.dataset.column);refreshTable(true);}
    else if(node.id==='department')model.department=node.value;
    else if(node.dataset.permission){if(node.checked)model.permissions.add(node.dataset.permission);else model.permissions.delete(node.dataset.permission);document.getElementById('selected-permissions').innerHTML=[...model.permissions].map(value=>`<span class="tag">${value}</span>`).join('');}
    else if(node.name==='delivery')model.delivery=node.value;
    else if(node.id==='date-start'||node.id==='date-end'){model[node.id==='date-start'?'dateStart':'dateEnd']=node.value;document.getElementById('range-error').textContent=model.rangeError;document.getElementById('date-end').setAttribute('aria-invalid',Boolean(model.rangeError));}
    else if(node.id==='sample-file'){model.fileName=node.files?.[0]?.name||'';document.getElementById('file-info').textContent=model.fileName||'尚未选择文件';}
    else return false;
    return true;
  }
  document.addEventListener('keydown',event=>{
    const demoTab=event.target.closest('[data-demo-tab]');
    if(demoTab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const tabs=['overview','members','history'];const next=event.key==='Home'?0:event.key==='End'?2:(tabs.indexOf(model.demoTab)+(event.key==='ArrowRight'?1:2))%3;model.demoTab=tabs[next];refreshDemoTab();document.getElementById('demo-tab-'+model.demoTab).focus();}
    if(event.key==='Escape'){const menu=event.target.closest('.action-menu');if(menu){menu.open=false;menu.querySelector('summary').focus();}}
  });

  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;const data=button.dataset;
    if(data.backend) { handleBackend(data.backend,button); return; }
    if(data.tableSort){model.sortTable(data.tableSort);refreshTable();return;}
    if(data.tablePage){model.tablePage=Math.max(1,Math.min(model.tablePages,Number(data.tablePage)));refreshTable();return;}
    if(data.treeChoice){model.treeChoice=data.treeChoice;document.querySelectorAll('[data-tree-choice]').forEach(node=>node.setAttribute('aria-selected',node.dataset.treeChoice===model.treeChoice));document.getElementById('tree-result').textContent='当前选择：'+model.treeChoice;return;}
    if(data.demoTab){model.demoTab=data.demoTab;refreshDemoTab();return;}
    if(data.step){if(model.step===3&&data.step==='1'){notify('多步配置演示已完成。');return;}model.step=Math.max(1,Math.min(3,model.step+Number(data.step)));document.getElementById('navigation-components').outerHTML=window.BackendPreview.navigation(model,icon);return;}
    if(data.metricPeriod){model.metricPeriod=data.metricPeriod;document.getElementById('metric-content').innerHTML=window.BackendPreview.metrics(model);return;}
    if(data.chartValue){document.getElementById('chart-selection').textContent=data.chartValue;return;}
    if(data.menuAction){document.getElementById('menu-result').textContent=data.menuAction+'：演示操作已触发。';button.closest('details').open=false;return;}
    if(data.colorChoice){model.chooseColor(data.colorChoice);paintAppearance();}
    else if(data.section){highlightSection(data.section);document.getElementById(data.section).scrollIntoView({block:'start'});const url=new URL(location.href);url.hash=data.section;history.replaceState(null,'',url);}
    else if(data.scenario){model.chooseScenario(data.scenario);render();document.querySelector(`[data-scenario="${model.scenario}"]`).focus();}
    else if(data.mode){model.chooseMode(data.mode);paintAppearance();}
    else if(data.view){model.chooseView(data.view);inlineOpen=false;render();window.scrollTo(0,0);button.focus();}
    else if(data.priority){model.priority=data.priority;model.saved=false;document.querySelectorAll('[data-priority]').forEach(node=>node.setAttribute('aria-pressed',node.dataset.priority===model.priority));document.getElementById('save-message').textContent='设置已修改';}
    else if(data.filter){model.filter=data.filter;render();document.querySelector(`[data-filter="${model.filter}"]`).focus();}
    else if(data.item||data.selectItem)showDetail(data.item||data.selectItem);
    else if('close' in data)dialog.close();
    else if('closeInline' in data){inlineOpen=false;document.getElementById('inline-detail').hidden=true;document.querySelector('[data-action="detail"]').setAttribute('aria-expanded','false');document.querySelector('[data-action="detail"]').focus();}
    else if(data.expand){model.toggleExpand(data.expand);document.querySelectorAll('[data-expand]').forEach(node=>{const open=model.expanded.has(node.dataset.expand);node.setAttribute('aria-expanded',open);document.getElementById(`expand-${node.dataset.expand}`).hidden=!open;});}

    else if(data.action==='detail')showDetail(1);
    else if(data.action==='sample-button'||data.action==='message')notify('操作反馈已显示，仅用于交互预览。');
    else if(data.action==='empty')notify('新建操作已触发；空内容样例保留供对照。');
    else if(data.action==='retry'){model.recovered=!model.recovered;document.getElementById('retry-title').innerHTML=icon(model.recovered?'check-circle':'warning')+(model.recovered?'已恢复连接':'暂时无法加载');document.getElementById('retry-description').textContent=model.recovered?'重试反馈已展示，其他状态保持可见。':'当前内容未丢失，可以重新尝试。';button.textContent=model.recovered?'再次演示失败':'重新尝试';}
    else if(data.action==='replay'){const sample=document.getElementById('motion-sample');sample.classList.remove('play');requestAnimationFrame(()=>requestAnimationFrame(()=>sample.classList.add('play')));}
    else if(data.action==='restore-page'){model.chooseScenario('normal');model.query='';model.filter='all';render();document.getElementById('project-search').focus();}
  });
  document.addEventListener('input',event=>{
    const input=event.target;if(event.isComposing)return;
    if(handleBackendInput(input))return;
    if(input.id==='project-name'){model.editName(input.value);input.setAttribute('aria-invalid',Boolean(model.error));document.getElementById('name-error').textContent=model.error;document.getElementById('save-message').textContent='设置已修改';}
    else if(input.id==='filled-input')model.sampleName=input.value;
    else if(input.id==='error-input'){model.invalidName=input.value;const invalid=input.value.trim().length<2;input.setAttribute('aria-invalid',invalid);const hint=document.getElementById('error-hint');hint.textContent=invalid?'至少输入 2 个字符。':'已修正，可以继续。';hint.className='field-hint '+(invalid?'error':'success');}
    else if(input.id==='project-search'){model.query=input.value;document.getElementById('page-content').innerHTML=renderPageContent();document.getElementById('result-count').textContent=`当前显示 ${model.visibleItems().length} 项`;}
  });
  document.addEventListener('change',event=>{
    const node=event.target;
    if(handleBackendChange(node))return;
    if(node.id==='notifications'){model.notify=node.checked;model.saved=false;document.getElementById('save-message').textContent='设置已修改';}
    else if(node.id==='project-name')model.editName(node.value);
  });
  document.addEventListener('submit',event=>{
    if(event.target.id!=='settings-form')return;event.preventDefault();model.editName(event.target.elements.projectName.value);
    if(!model.beginSave()){document.getElementById('name-error').textContent=model.error;document.getElementById('project-name').setAttribute('aria-invalid','true');document.getElementById('project-name').focus();return;}
    render();setTimeout(()=>{model.finishSave();if(model.view==='components'){render();document.querySelector('#settings-form [type="submit"]').focus();}else notify('演示设置已保存。');},650);
  });
  document.querySelector('.view-tabs').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const views=['components','layout','info'];const next=event.key==='Home'?0:event.key==='End'?2:(views.indexOf(model.view)+(event.key==='ArrowRight'?1:2))%3;model.chooseView(views[next]);render();window.scrollTo(0,0);document.getElementById(`tab-${model.view}`).focus();
  });
  document.getElementById('color-tabs').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const colors=libraries[model.library].colors;const current=colors.findIndex(color=>color.id===model.color);const next=event.key==='Home'?0:event.key==='End'?colors.length-1:(current+(event.key==='ArrowRight'?1:colors.length-1))%colors.length;model.chooseColor(colors[next].id);paintAppearance();document.querySelector(`[data-color-choice="${model.color}"]`).focus();
  });
  render();
})();
