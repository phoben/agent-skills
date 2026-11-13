const task=await taskSpace('issue-hub-image-preview-1105');
console.log({spaceId:task.spaceId,page:task.page('p1').label});
