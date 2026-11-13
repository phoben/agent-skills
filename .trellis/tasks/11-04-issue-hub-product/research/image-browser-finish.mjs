const task=await taskSpace(26);
await task.finish({keep:[]});
console.log({spaceId:26,finished:true});
