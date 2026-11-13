const task = await takeOverTaskSpace(8);
console.log({ spaceId: task.spaceId, ownership: task.ownership, pages: (await task.pages()).map(p => ({ label: p.label, openedBy: p.openedBy })) });
console.log({ page: 'p1', url: await task.page('p1').url() });
