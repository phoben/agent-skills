/* 流量对照板交互原型。所有统计来自同目录的虚构数据。 */
const startTokensPrototype = () => {
 const D=window.TOKEN_DATA;
 const queryMode=new URLSearchParams(location.search).get('state');
 const state={start:'2026-10-28',end:D.now,preset:'近7天',page:0,selection:null,search:'',sort:'tokens',mode:['empty','error','loading'].includes(queryMode)?queryMode:'ready'};
 const $=s=>document.querySelector(s), all=s=>[...document.querySelectorAll(s)];
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>n>=1e9?(n/1e9).toFixed(2)+'B':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1000?(n/1000).toFixed(n>=1e5?0:1)+'K':Math.round(n).toLocaleString('zh-CN');
 const dateText=s=>`${Number(s.slice(5,7))}月${Number(s.slice(8))}日`;
 const days=(a,b)=>{const out=[];for(let d=new Date(a+'T00:00:00Z');d.toISOString().slice(0,10)<=b;d.setUTCDate(d.getUTCDate()+1))out.push(d.toISOString().slice(0,10));return out;};
 const sum=(arr,key)=>arr.reduce((n,r)=>n+r[key],0);
 let current, opener;
 function aggregate(){
  const records=state.mode==='empty'?[]:D.events.filter(r=>r.date>=state.start&&r.date<=state.end), dates=days(state.start,state.end);
  const projects=state.mode==='empty'?[]:D.projects.map(p=>{const events=records.filter(r=>r.project===p.id);return {...p,events,total:sum(events,'tokens'),cached:sum(events,'cached'),uncached:sum(events,'uncached'),output:sum(events,'output'),daily:dates.map(date=>sum(events.filter(r=>r.date===date),'tokens'))};});
  const account=D.accountDaily.filter(r=>r.date>=state.start&&r.date<=state.end);
  return {records,dates,projects,account,accountTotal:sum(account,'tokens'),total:sum(records,'tokens'),cached:sum(records,'cached'),uncached:sum(records,'uncached'),output:sum(records,'output')};
 }
 function render(){
  current=aggregate();
  const values={account:fmt(current.accountTotal),local:fmt(current.total),projects:current.projects.length,sessions:current.records.length,cached:fmt(current.cached),uncached:fmt(current.uncached),output:fmt(current.output),'cache-share':current.cached+current.uncached?(100*current.cached/(current.cached+current.uncached)).toFixed(1)+'%':'—'};
  if(['error','loading'].includes(state.mode))Object.keys(values).filter(key=>key!=='account').forEach(key=>values[key]='—');
  all('[data-stat]').forEach(el=>el.textContent=values[el.dataset.stat]??'');
  all('[data-date-label]').forEach(el=>el.textContent=state.preset);
  all('[data-date-range]').forEach(el=>el.textContent=`${dateText(state.start)} – ${dateText(state.end)}`);
  renderTrend();
  if(!renderPanelState()){renderMatrix();renderFlow();renderType();}
  hideTooltip();
 }
 function renderPanelState(){
  const canvas=$('.comparison-canvas'),panel=$('#panel-state'),mode=state.mode;
  canvas.hidden=mode!=='ready';panel.hidden=mode==='ready';
  if(mode==='ready')return false;
  if(mode==='loading')panel.innerHTML='<div class="state-heading"><span class="loading-spinner" aria-hidden="true"></span><h2>正在读取本机用量</h2><p>账号汇总已显示，项目与会话明细正在更新。</p></div><div class="chart-skeleton" aria-hidden="true">'+Array.from({length:5},()=>'<div><i></i><span></span><span></span><span></span><span></span></div>').join('')+'</div>';
  if(mode==='empty')panel.innerHTML='<div class="state-heading"><span class="state-symbol" aria-hidden="true">—</span><h2>这个日期范围没有本机项目记录</h2><p>可以调整日期。账号汇总包含其他设备的活动，单独展示。</p><button class="state-action" data-recover>查看近7天</button></div>';
  if(mode==='error')panel.innerHTML='<div class="state-heading"><span class="state-symbol" aria-hidden="true">!</span><h2>暂时无法读取本机项目记录</h2><p>账号汇总仍可查看。重新读取后继续查看项目与会话。</p><button class="state-action" data-recover>重新读取</button></div>';
  const scale=$('#matrix-scale');if(scale)scale.textContent=mode==='loading'?'正在更新项目记录':'本机可归属会话';
  return true;
 }
 function renderTrend(){
  const el=$('#account-trend');if(!el)return;
  const data=current.account,max=Math.max(...data.map(d=>d.tokens),1),min=Math.min(...data.map(d=>d.tokens),0);
  const points=data.map((r,i)=>`${10+i*280/Math.max(data.length-1,1)},${48-(r.tokens-min)/(max-min)*37}`).join(' ');
  el.innerHTML=`<svg viewBox="0 0 300 68" role="img" aria-label="${escape(state.preset)}官方账号每日用量趋势"><path d="M10 49H290" class="trend-grid"/><polyline points="${points}" class="trend-line"/><text x="10" y="65" class="trend-caption">${dateText(state.start)}</text><text x="290" y="65" text-anchor="end" class="trend-caption">${dateText(state.end)}</text></svg>`;
 }
 function renderMatrix(){
  const el=$('#project-matrix');if(!el)return;
  const n=current.dates.length,width=Math.max(el.clientWidth,238+n*28),max=Math.max(1,...current.projects.flatMap(p=>p.daily));
  const cols=`155px repeat(${n},minmax(28px,1fr)) 83px`;
  const step=n>31?Math.ceil(n/12):n>10?Math.ceil(n/10):1;
  el.innerHTML=`<div class="matrix-scroll"><div class="matrix-table" role="table" aria-label="项目每日Tokens用量" style="width:${width}px;--matrix-cols:${cols}"><div class="matrix-head" role="row"><span role="columnheader">项目</span>${current.dates.map((date,i)=>`<span title="${date}" role="columnheader">${i%step===0||i===n-1?date.slice(5).replace('-','/'):''}</span>`).join('')}<span role="columnheader">范围内合计</span></div>${current.projects.map(p=>`<div class="matrix-row" role="row" tabindex="0" data-project="${p.id}" aria-label="查看${escape(p.name)}在${escape(state.preset)}的${p.events.length}个会话"><div class="matrix-project" role="rowheader"><strong>${escape(p.name)}</strong><small>${p.events.length} 个会话</small></div>${p.daily.map((value,i)=>`<div class="day-cell" role="cell"><button class="day-hit" tabindex="${i===0?0:-1}" style="--value:${value/max}" data-project="${p.id}" data-day="${current.dates[i]}" aria-label="查看${escape(p.name)}${dateText(current.dates[i])}会话，用量${fmt(value)}"><span class="day-bar"></span></button></div>`).join('')}<div class="matrix-total" role="cell">${fmt(p.total)}<small>${(p.total/current.total*100).toFixed(1)}%</small></div></div>`).join('')}</div></div>`;
  const scale=$('#matrix-scale');if(scale)scale.textContent=`统一刻度 0–${fmt(max)} · 按日${n>10?' · 横向滚动查看':''}`;
 }
 function renderType(){const el=$('#type-strip');if(el)el.innerHTML=`<div class="type-strip" aria-label="本机Tokens类型占比">${['cached','uncached','output'].map(k=>`<span style="width:${current[k]/current.total*100}%"></span>`).join('')}</div>`;}
 function renderFlow(){
  const el=$('#flow-chart');if(!el)return;
  const w=Math.max(el.clientWidth,260),h=Math.max(el.clientHeight,200),vertical=el.dataset.orientation==='vertical',aligned=el.dataset.orientation==='aligned';
  const types=[{key:'cached',name:'缓存输入',color:'var(--cache)'},{key:'uncached',name:'非缓存输入',color:'var(--uncached)'},{key:'output',name:'输出',color:'var(--output)'}];
  let paths='',nodes='';
  if(vertical){
   const scale=Math.min((w-90)/current.total,((w-30)/5-12)/Math.max(...current.projects.map(p=>p.total))),sourceY=52,targetY=h-72;
   const targetCenters=[w*.21,w*.61,w*.87],targetCursor=types.map((t,i)=>targetCenters[i]-current[t.key]*scale/2);
   current.projects.forEach((p,index)=>{
    const x=(index+.5)*w/5,thickness=p.total*scale;let cursor=x-thickness/2;
    types.forEach((t,j)=>{const size=p[t.key]*scale,to=targetCursor[j];targetCursor[j]+=size;paths+=`<path class="flow-link" data-flow-project="${p.id}" data-flow-type="${t.key}" fill="${t.color}" opacity=".58" d="M${cursor} ${sourceY+4} C${cursor} ${sourceY+65},${to} ${targetY-65},${to} ${targetY} L${to+size} ${targetY} C${to+size} ${targetY-65},${cursor+size} ${sourceY+65},${cursor+size} ${sourceY+4}Z"><title>${escape(p.name)} → ${t.name} ${fmt(p[t.key])}</title></path>`;cursor+=size;});
    nodes+=`<g class="flow-node" data-project="${p.id}"><text class="flow-label" text-anchor="middle" x="${x}" y="17" style="font-size:${p.short.length>8?10:11}px">${escape(p.short)}</text><text class="flow-note" text-anchor="middle" x="${x}" y="34">${fmt(p.total)}</text><rect x="${x-thickness/2}" y="${sourceY}" width="${thickness}" height="4" rx="1" fill="var(--accent)"/></g>`;
   });
   types.forEach((t,i)=>{const size=current[t.key]*scale,x=targetCenters[i];nodes+=`<rect x="${x-size/2}" y="${targetY}" width="${size}" height="4" rx="1" fill="${t.color}"/><text class="flow-label" text-anchor="middle" x="${x}" y="${targetY+24}">${t.name}</text><text class="flow-note" text-anchor="middle" x="${x}" y="${targetY+43}">${(current[t.key]/current.total*100).toFixed(1)}%</text>`;});
  }else{
   const rows=all('.matrix-row'),rect=el.getBoundingClientRect();
   const centers=current.projects.map((p,i)=>aligned&&rows[i]?rows[i].getBoundingClientRect().top+rows[i].getBoundingClientRect().height/2-rect.top:24+i*(h-48)/4);
   const sourceX=aligned?7:112,targetX=w-92;
   const spacing=Math.min(...centers.slice(1).map((v,i)=>v-centers[i]));
   const scale=Math.min((h-90)/current.total,(spacing-13)/Math.max(...current.projects.map(p=>p.total)));
   const gap=27,totalHeight=current.total*scale+gap*2;
   let targetTop=(h-totalHeight)/2;
   const targets=types.map(t=>{const top=targetTop;targetTop+=current[t.key]*scale+gap;return {top,cursor:top};});
   current.projects.forEach((p,i)=>{
    const thickness=p.total*scale;let cursor=centers[i]-thickness/2;
    types.forEach((t,j)=>{const size=p[t.key]*scale,to=targets[j].cursor;targets[j].cursor+=size;paths+=`<path class="flow-link" data-flow-project="${p.id}" data-flow-type="${t.key}" fill="${t.color}" opacity=".58" d="M${sourceX} ${cursor} C${sourceX+(targetX-sourceX)*.45} ${cursor},${sourceX+(targetX-sourceX)*.55} ${to},${targetX} ${to} L${targetX} ${to+size} C${sourceX+(targetX-sourceX)*.55} ${to+size},${sourceX+(targetX-sourceX)*.45} ${cursor+size},${sourceX} ${cursor+size}Z"><title>${escape(p.name)} → ${t.name} ${fmt(p[t.key])}</title></path>`;cursor+=size;});
    nodes+=`<g class="flow-node" data-project="${p.id}">${aligned?'':`<text x="0" y="${centers[i]-3}" class="flow-label">${escape(p.short)}</text><text x="0" y="${centers[i]+13}" class="flow-note">${fmt(p.total)}</text>`}<rect x="${sourceX-4}" y="${centers[i]-thickness/2}" width="4" height="${thickness}" rx="1" fill="var(--accent)"/></g>`;
   });
   types.forEach((t,j)=>{const size=current[t.key]*scale,mid=targets[j].top+size/2;nodes+=`<rect x="${targetX}" y="${targets[j].top}" width="4" height="${size}" rx="1" fill="${t.color}"/><text x="${targetX+12}" y="${mid-4}" class="flow-label">${t.name}</text><text x="${targetX+12}" y="${mid+13}" class="flow-note">${fmt(current[t.key])} · ${(current[t.key]/current.total*100).toFixed(1)}%</text>`;});
  }
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="本机项目至Tokens类型的桑基图，流带宽度与用量成比例">${paths}${nodes}</svg>`;
 }
 function openSessions(project,day,target){
  state.selection={project,day};state.page=0;state.search='';state.sort='tokens';opener=target;hideTooltip();
  $('#session-search').value='';$('#session-sort').value='tokens';
  renderSessions();$('#session-dialog').showModal();
 }
 function renderSessions(){
  const {project,day}=state.selection,p=current.projects.find(p=>p.id===project);
  const records=p.events.filter(r=>!day||r.date===day),term=state.search.trim().toLowerCase();
  const filtered=records.filter(r=>(r.title+' '+r.model).toLowerCase().includes(term)).sort((a,b)=>state.sort==='date'?(b.date+b.time).localeCompare(a.date+a.time):state.sort==='output'?b.output-a.output:b.tokens-a.tokens);
  const page=state.page,selected=filtered.slice(page*10,page*10+10),total=sum(records,'tokens');
  $('#dialog-title').textContent=p.name+' · 会话用量';
  $('#dialog-scope').textContent=day?`${dateText(day)} · 单日项目会话`:`${dateText(state.start)} – ${dateText(state.end)} · 项目全部会话`;
  $('#dialog-content').innerHTML=`<div class="dialog-summary"><strong>${fmt(total)}<span> Tokens</span></strong><span>范围内 ${records.length} 个会话 · 已合并子代理用量</span></div><table class="session-table"><thead><tr><th>会话 / 模型</th><th>日期</th><th>缓存输入</th><th>非缓存输入</th><th>输出</th><th>合计 Tokens</th></tr></thead><tbody>${selected.map(r=>`<tr><td><span>${escape(r.title)}</span><small>${escape(r.model)} · ${r.agents?'含 '+r.agents+' 个子代理':'主会话'}</small></td><td>${dateText(r.date)}<small>${r.time}</small></td><td>${fmt(r.cached)}</td><td>${fmt(r.uncached)}</td><td>${fmt(r.output)}</td><td>${fmt(r.tokens)}</td></tr>`).join('')}</tbody></table>${filtered.length?'':'<div class="dialog-empty"><strong>没有匹配的会话</strong><p>试试其他关键词，或清除当前搜索。</p><button class="state-action" data-clear-search>清除搜索</button></div>'}`;
  $('#dialog-foot').innerHTML=`<span>${term?`匹配 ${filtered.length} / ${records.length} 个会话`:'本机可归属会话'} · ${day?dateText(day):state.preset}</span><span class="dialog-pagination"><button data-page="prev" ${page===0?'disabled':''}>上一页</button><span>${page+1} / ${Math.max(1,Math.ceil(filtered.length/10))}</span><button data-page="next" ${(page+1)*10>=filtered.length?'disabled':''}>下一页</button></span>`;
 }
 function hideTooltip(){const tooltip=$('#chart-tooltip');if(tooltip)tooltip.hidden=true;}
 function showTooltip(project,day,event){
  const p=current.projects.find(p=>p.id===project);if(!p)return;
  const records=p.events.filter(r=>!day||r.date===day),total=sum(records,'tokens');
  const tooltip=$('#chart-tooltip');
  tooltip.innerHTML=`<strong>${escape(p.name)}</strong><span>${day?dateText(day):state.preset} · ${records.length} 个会话</span><b>${fmt(total)} <small>Tokens</small></b><div><span>缓存 ${fmt(sum(records,'cached'))}</span><span>非缓存 ${fmt(sum(records,'uncached'))}</span><span>输出 ${fmt(sum(records,'output'))}</span></div>`;
  const target=event.target.closest('[data-day],.flow-link,.flow-node')||event.target,rect=target.getBoundingClientRect();
  const x=event.clientX||rect.left+rect.width/2,y=event.clientY||rect.top;
  tooltip.style.left=Math.max(12,Math.min(innerWidth-290,x+16))+'px';
  tooltip.style.top=Math.max(12,Math.min(innerHeight-160,y-145))+'px';tooltip.hidden=false;
 }
 function highlightProject(project,day){
  all('.matrix-row').forEach(row=>row.classList.toggle('is-highlighted',row.dataset.project===project));
  all('[data-day]').forEach(cell=>cell.classList.toggle('same-day',!!day&&cell.dataset.day===day));
  all('.flow-link').forEach(path=>path.style.opacity=!project?'.58':path.dataset.flowProject===project?'.9':'.12');
 }
 function range(preset){const end=D.now,d=new Date(end+'T00:00:00Z');let start;
  if(preset==='近7天'||preset==='近30天'){d.setUTCDate(d.getUTCDate()-(preset==='近7天'?6:29));start=d.toISOString().slice(0,10);}
  if(preset==='本周'){d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));start=d.toISOString().slice(0,10);}
  if(preset==='本月')start=end.slice(0,7)+'-01';
  if(preset==='本季度')start=`${end.slice(0,4)}-${String(Math.floor((Number(end.slice(5,7))-1)/3)*3+1).padStart(2,'0')}-01`;
  if(preset==='本年')start=end.slice(0,4)+'-01-01';return {start,end};}
 function apply(start,end,preset){state.start=start;state.end=end;state.preset=preset;state.mode='ready';$('#period-popover').hidePopover();render();}
 function inject(){
  document.body.insertAdjacentHTML('beforeend',`<div id="period-popover" class="period-popover" popover="auto" aria-label="选择统计日期"><div class="period-presets">${['本周','近7天','近30天','本月','本季度','本年'].map(name=>`<button data-preset="${name}">${name}</button>`).join('')}<button data-custom>自定义日期</button></div><div class="period-custom"><h3>自定义日期区间</h3><label>开始日期<input id="date-start" type="date" min="${D.start}" max="${D.now}"></label><label>结束日期<input id="date-end" type="date" min="${D.start}" max="${D.now}"></label><p class="period-error" role="alert" id="period-error"></p><button class="period-apply" id="period-apply">应用日期</button></div></div><dialog id="session-dialog" class="session-dialog" aria-labelledby="dialog-title" aria-describedby="dialog-scope"><header class="dialog-head"><div><h2 id="dialog-title"></h2><div class="dialog-scope" id="dialog-scope"></div></div><button class="dialog-close" aria-label="关闭会话明细" autofocus>×</button></header><div class="session-toolbar"><label class="session-search"><span>搜索会话</span><input id="session-search" type="search" placeholder="搜索会话名称或模型" autocomplete="off"></label><label class="session-sort">排序<select id="session-sort"><option value="tokens">用量最多</option><option value="date">最近会话</option><option value="output">输出最多</option></select></label></div><div class="dialog-content" id="dialog-content"></div><footer class="dialog-foot" id="dialog-foot"></footer></dialog><div id="chart-tooltip" class="chart-tooltip" hidden role="tooltip"></div>`);
  $('.comparison-canvas').insertAdjacentHTML('afterend','<div id="panel-state" class="panel-state" hidden role="status" aria-live="polite"></div>');
  $('#session-search').addEventListener('input',event=>{state.search=event.target.value;state.page=0;renderSessions();});
  $('#session-sort').addEventListener('change',event=>{state.sort=event.target.value;state.page=0;renderSessions();$('#dialog-content').scrollTop=0;});
  all('.date-trigger').forEach(button=>{button.setAttribute('aria-controls','period-popover');button.setAttribute('aria-expanded','false');button.addEventListener('click',()=>{const pop=$('#period-popover');$('#date-start').value=state.start;$('#date-end').value=state.end;$('#period-error').textContent='';all('[data-preset]').forEach(el=>el.classList.toggle('current',el.dataset.preset===state.preset));pop.togglePopover();});});
  $('#period-popover').setAttribute('role','dialog');
  $('#period-popover').addEventListener('toggle',event=>all('.date-trigger').forEach(button=>button.setAttribute('aria-expanded',String(event.newState==='open'))));
  all('[data-preset]').forEach(button=>button.addEventListener('click',()=>{const r=range(button.dataset.preset);apply(r.start,r.end,button.dataset.preset);}));
  $('[data-custom]').addEventListener('click',()=>$('#date-start').focus());
  $('#period-apply').addEventListener('click',()=>{const start=$('#date-start').value,end=$('#date-end').value;if(!start||!end||start>end||start<D.start||end>D.now){$('#period-error').textContent='请选择有效日期，开始日期不能晚于结束日期。';return;}apply(start,end,'自定义');});
  $('.dialog-close').addEventListener('click',()=>$('#session-dialog').close());
  $('#session-dialog').addEventListener('click',event=>{if(event.target.id==='session-dialog'){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
  $('#session-dialog').addEventListener('close',()=>{opener?.focus();});
  $('#dialog-foot').addEventListener('click',e=>{const button=e.target.closest('[data-page]');if(!button||button.disabled)return;state.page+=button.dataset.page==='next'?1:-1;renderSessions();$('#dialog-content').scrollTop=0;});
  document.addEventListener('click',event=>{
   if(event.target.closest('[data-recover]')){state.mode='loading';render();setTimeout(()=>{state.mode='ready';render();},500);return;}
   if(event.target.closest('[data-clear-search]')){state.search='';state.page=0;$('#session-search').value='';renderSessions();$('#session-search').focus();return;}
   const day=event.target.closest('[data-day]');if(day){event.stopPropagation();openSessions(day.dataset.project,day.dataset.day,day);return;}
   const row=event.target.closest('.matrix-row');if(row){openSessions(row.dataset.project,null,row);return;}
   const node=event.target.closest('.flow-node,.flow-link');if(node){const id=node.dataset.project||node.dataset.flowProject;openSessions(id,null,$(`.matrix-row[data-project="${id}"]`));}
  });
  document.addEventListener('keydown',event=>{
   if(event.target.classList?.contains('matrix-row')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openSessions(event.target.dataset.project,null,event.target);return;}
   const cell=event.target.closest?.('[data-day]');if(!cell)return;
   const project=current.projects.findIndex(p=>p.id===cell.dataset.project),day=current.dates.indexOf(cell.dataset.day);let nextProject=project,nextDay=day;
   if(event.key==='ArrowRight')nextDay=Math.min(day+1,current.dates.length-1);else if(event.key==='ArrowLeft')nextDay=Math.max(day-1,0);else if(event.key==='ArrowDown')nextProject=Math.min(project+1,current.projects.length-1);else if(event.key==='ArrowUp')nextProject=Math.max(project-1,0);else if(event.key==='Home')nextDay=0;else if(event.key==='End')nextDay=current.dates.length-1;else return;
   event.preventDefault();const next=$(`[data-project="${current.projects[nextProject].id}"][data-day="${current.dates[nextDay]}"]`);cell.tabIndex=-1;next.tabIndex=0;next.focus();
  });
  const matrix=$('#project-matrix');
  matrix?.addEventListener('pointerover',event=>{const row=event.target.closest('.matrix-row'),cell=event.target.closest('[data-day]');highlightProject(row?.dataset.project,cell?.dataset.day);if(cell)showTooltip(cell.dataset.project,cell.dataset.day,event);else hideTooltip();});
  matrix?.addEventListener('pointermove',event=>{const cell=event.target.closest('[data-day]');if(cell)showTooltip(cell.dataset.project,cell.dataset.day,event);});
  matrix?.addEventListener('pointerleave',()=>{highlightProject(null);hideTooltip();});
  matrix?.addEventListener('focusin',event=>{const cell=event.target.closest('[data-day]');if(cell){highlightProject(cell.dataset.project,cell.dataset.day);showTooltip(cell.dataset.project,cell.dataset.day,event);}});
  matrix?.addEventListener('focusout',()=>{highlightProject(null);hideTooltip();});
  $('#flow-chart')?.addEventListener('pointerover',event=>{const path=event.target.closest('.flow-link');if(path){highlightProject(path.dataset.flowProject);showTooltip(path.dataset.flowProject,null,event);}});
  $('#flow-chart')?.addEventListener('pointerleave',()=>{highlightProject(null);hideTooltip();});
 }
 inject();render();
 if(state.mode==='loading')setTimeout(()=>{state.mode='ready';render();},5000);
 let pending;window.addEventListener('resize',()=>{cancelAnimationFrame(pending);pending=requestAnimationFrame(()=>{if(state.mode==='ready'){renderMatrix();renderFlow();}});});
 window.TOKEN_PROTOTYPE={state,get current(){return current;},render};
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startTokensPrototype,{once:true});else startTokensPrototype();
