const task = await taskSpace('issue-hub-local-acceptance-1104');
console.log({ spaceId: task.spaceId, name: task.name, page: task.page('p1').label });
