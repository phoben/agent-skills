const task=await taskSpace(8), page=task.page('p1');
console.log(await page.evaluate(()=>{const frame=document.querySelector('iframe'),doc=frame.contentDocument,detail=doc.querySelector('#detail'),input=doc.querySelector('#comment-body');return {frame:frame.getBoundingClientRect().toJSON(),detail:detail?.getBoundingClientRect().toJSON(),scrollHeight:detail?.scrollHeight,scrollTop:detail?.scrollTop,input:input?.getBoundingClientRect().toJSON(),inputExists:Boolean(input),hidden:document.hidden};}));
console.log(await page.snapshot());
