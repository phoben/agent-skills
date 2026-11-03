/* 本文件提供设计原型的统一虚构数据，不访问账号或会话文件。 */
(() => {
  const now = '2026-11-03';
  const start = '2026-01-01';
  const dates7 = ['2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03'];
  const projects = [
    {id:'clue',name:'Clue 业务平台',short:'Clue',description:'客户与业务协同',totals:[6500000,1350000,570000],daily:[.92,1.26,1.05,1.84,.71,1.56,1.08],counts:[6,6,6,6,6,6,6]},
    {id:'aoy',name:'AOY ERP',short:'AOY',description:'订单与库存管理',totals:[4900000,930000,350000],daily:[.66,1.02,.89,1.23,.64,1.02,.72],counts:[5,5,5,6,5,5,5]},
    {id:'branchkite',name:'Branchkite',short:'Branchkite',description:'开发工作区',totals:[2850000,620000,270000],daily:[.36,.58,.46,.82,.42,.63,.47],counts:[3,4,3,4,3,4,3]},
    {id:'toolkit',name:'YG Toolkit',short:'YG Toolkit',description:'工程与文档工具',totals:[1640000,390000,130000],daily:[.23,.32,.28,.41,.25,.36,.31],counts:[2,3,2,3,2,3,3]},
    {id:'showcase',name:'Showcase',short:'Showcase',description:'应用展示平台',totals:[950000,580000,150000],daily:[.18,.24,.23,.28,.23,.31,.21],counts:[4,4,4,4,4,4,4]}
  ];
  const titles = {
    clue:['扩展 MCP 工具与配置导出','企业微信机器人消息与会话','工作项筛选与权限校验','完善服务工单查询','检查客户资料导入','审查项目权限与租户隔离'],
    aoy:['订单库存联动校验','整理 SKU 与库存迁移','完善供应商对账','审查部署流水线','采购入库数据检查','处理商品规格筛选'],
    branchkite:['实现项目工作区发现','调整 Issue 明细交互','检查工作树会话关联','完善插件连接状态'],
    toolkit:['设计 Tokens 用量工作台','完善需求文档技能','检查插件发布流程'],
    showcase:['调整应用目录展示','优化静态应用发布流程','检查构建与资源路径','完善首页导航']
  };
  const events = [], accountDaily = [];
  let day = 0;
  for(let date = new Date(start+'T00:00:00Z');date.toISOString().slice(0,10)<=now;date.setUTCDate(date.getUTCDate()+1),day++){
    const key=date.toISOString().slice(0,10), known=dates7.indexOf(key);
    let local=0;
    projects.forEach((project,index)=>{
      const total=known>=0?Math.round(project.daily[known]*1e6):Math.round((.13+((day*17+index*29)%73)/100)*(1.5-index*.21)*1e6);
      local+=total;
      const count=known>=0?project.counts[known]:2+(day+index)%5;
      const weights=Array.from({length:count},(_,i)=>1+((day+i*3+index)%7));
      const weightTotal=weights.reduce((a,b)=>a+b,0), projectTotal=project.totals.reduce((a,b)=>a+b,0);
      let assigned=0;
      weights.forEach((weight,i)=>{
        const tokens=i===count-1?total-assigned:Math.floor(total*weight/weightTotal);assigned+=tokens;
        const cached=Math.round(tokens*project.totals[0]/projectTotal), uncached=Math.round(tokens*project.totals[1]/projectTotal);
        events.push({id:`${key}-${project.id}-${i}`,date:key,project:project.id,title:titles[project.id][i%titles[project.id].length],time:`${String(9+(i*2)%12).padStart(2,'0')}:${String((42+i*11)%60).padStart(2,'0')}`,model:i%4===0?'GPT-6.1':'GPT-6.1 Codex',agents:i%3,cached,uncached,output:tokens-cached-uncached,tokens});
      });
    });
    accountDaily.push({date:key,tokens:known>=0?Math.round([3.12,4.48,3.76,5.82,2.94,4.91,3.61][known]*1e6):Math.round(local*(1.16+((day*7)%27)/100))});
  }
  window.TOKEN_DATA={now,start,projects,events,accountDaily};
})();
