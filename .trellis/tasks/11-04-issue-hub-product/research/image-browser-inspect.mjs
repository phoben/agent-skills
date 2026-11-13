const task=await taskSpace(26),page=task.page('p1');
console.log(await page.evaluate(()=>{
  const d=document.querySelector('iframe')?.contentDocument;
  return{images:[...(d?.querySelectorAll('.issue-image')||[])].map(n=>{const img=n.querySelector('img');return{state:n.dataset.imageState,status:n.querySelector('.image-status')?.textContent,srcPresent:!!img?.getAttribute('src'),dataSrc:img?.getAttribute('src')?.startsWith('data:'),srcLength:img?.getAttribute('src')?.length,hidden:img?.hidden,complete:img?.complete,width:img?.naturalWidth,connected:img?.isConnected};}),requests:performance.getEntriesByType('resource').filter(e=>e.name.includes('/tool')).map(e=>({duration:Math.round(e.duration),bytes:e.decodedBodySize})),selected:d?.querySelector('.issue-row.selected')?.dataset.number,errors:[...(d?.querySelectorAll('[role="alert"],.global-message')||[])].map(n=>n.textContent)};
}));
