const task = await taskSpace(7);
const linear = task.page('p2');
console.log({ page: linear.label, url: await linear.url() });
console.log((await linear.snapshot()).slice(0, 13000));
