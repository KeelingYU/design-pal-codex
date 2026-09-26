(function () {
  'use strict';
  const {libraries,GalleryModel}=window.DesignPalPreview;
  const model=new GalleryModel();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)Object.keys(libraries).forEach(key=>model.paused.add(key));
  const types=[...new Set(Object.values(libraries).flatMap(library=>library.fit))];
  const grid=document.getElementById('library-grid');
  function url(key){return `./preview.html?library=${key}&color=${model.color(key).id}&rev=20260926-nav`;}
  function render(){
    document.getElementById('product-filters').innerHTML=[['all','全部'],...types.map(type=>[type,type])].map(([key,label])=>`<button data-product-filter="${key}" aria-pressed="${model.filter===key}">${label}</button>`).join('');
    document.getElementById('library-count').textContent=`${model.visibleLibraries().length} 个组件库 · 每库 2 种配色`;
    grid.innerHTML=model.visibleLibraries().map(([key,library])=>`<article class="library-card" data-library="${key}" data-active-color="${model.color(key).id}"><div class="card-heading"><h2><a data-entry href="${url(key)}" aria-label="查看${library.name}组件库">${library.name}</a></h2><span aria-hidden="true">↗</span></div><p class="library-description">${library.description}</p><div class="library-tags" aria-label="适用产品类型">${library.fit.map(tag=>`<button data-product-filter="${tag}" aria-label="筛选${tag}">${tag}</button>`).join('')}</div><div class="carousel" role="region" aria-roledescription="轮播" aria-label="${library.name}配色预览"><div class="preview-image"><a data-entry href="${url(key)}" aria-label="打开${library.name}当前配色"><div class="slide-track" style="transform:translateX(-${model.positions[key]*100}%)">${library.colors.slice(0,2).map((color,index)=>`<div class="color-slide" aria-hidden="${model.positions[key]!==index}"><img src="./previews/${key}-${color.id}.jpg" alt="${library.name}的${color.name}配色实际预览" width="931" height="792"></div>`).join('')}</div></a><button class="carousel-arrow previous" data-direction="-1" aria-label="${library.name}上一配色">‹</button><button class="carousel-arrow next" data-direction="1" aria-label="${library.name}下一配色">›</button></div><div class="carousel-tools"><div class="color-dots" role="group" aria-label="${library.name}颜色选择">${library.colors.map((color,index)=>`<button data-color-index="${index}" style="--dot:${color.light.accent}" aria-label="查看${color.name}配色" aria-pressed="${model.positions[key]===index}" title="${color.name}"></button>`).join('')}</div><button class="rotation-toggle" data-rotation aria-label="${model.paused.has(key)?'播放':'暂停'}${library.name}自动轮播">${model.paused.has(key)?'播放':'暂停'}</button></div><div class="color-caption"><strong>${model.color(key).name}</strong><p>${model.color(key).description}</p></div></div></article>`).join('');
  }
  function updateCard(key){
    const card=grid.querySelector(`[data-library="${key}"]`);if(!card)return;
    const color=model.color(key);card.dataset.activeColor=color.id;
    card.querySelector('.slide-track').style.transform=`translateX(-${model.positions[key]*100}%)`;
    card.querySelectorAll('.color-slide').forEach((slide,index)=>slide.setAttribute('aria-hidden',model.positions[key]!==index));
    card.querySelectorAll('[data-color-index]').forEach(dot=>dot.setAttribute('aria-pressed',Number(dot.dataset.colorIndex)===model.positions[key]));
    card.querySelectorAll('[data-entry]').forEach(link=>link.href=url(key));
    card.querySelector('.color-caption strong').textContent=color.name;card.querySelector('.color-caption p').textContent=color.description;
    const toggle=card.querySelector('[data-rotation]');toggle.textContent=model.paused.has(key)?'播放':'暂停';toggle.setAttribute('aria-label',`${model.paused.has(key)?'播放':'暂停'}${libraries[key].name}自动轮播`);
  }
  document.addEventListener('click',event=>{
    const filter=event.target.closest('[data-product-filter]');
    if(filter){model.filter=filter.dataset.productFilter;render();document.querySelector(`#product-filters [data-product-filter="${model.filter}"]`).focus();return;}
    const card=event.target.closest('.library-card');if(!card)return;const key=card.dataset.library,button=event.target.closest('button');
    if(button?.dataset.direction){model.move(key,Number(button.dataset.direction));updateCard(key);}
    else if(button?.dataset.colorIndex!==undefined){model.choose(key,Number(button.dataset.colorIndex));updateCard(key);}
    else if(button?.hasAttribute('data-rotation')){if(model.paused.has(key))model.paused.delete(key);else model.paused.add(key);updateCard(key);}
    else if(!event.target.closest('a'))location.href=url(key);
  });
  grid.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
    const card=event.target.closest('.library-card');if(!card)return;
    event.preventDefault();const key=card.dataset.library;model.move(key,event.key==='ArrowLeft'?-1:1);updateCard(key);card.querySelector(`[data-color-index="${model.positions[key]}"]`).focus();
  });
  setInterval(()=>{
    if(document.hidden)return;
    for(const card of grid.querySelectorAll('.library-card')){
      const key=card.dataset.library;
      if(model.paused.has(key)||card.matches(':hover')||card.contains(document.activeElement))continue;
      model.move(key,1);updateCard(key);
    }
  },5000);
  render();
})();
