const task = await taskSpace(21);
await task.finish({ keep: [] });
console.log({ spaceId: 21, finished: true });
