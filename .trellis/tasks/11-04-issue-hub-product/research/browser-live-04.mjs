const task = await taskSpace(8);
console.log(await task.page('p1').snapshot());
