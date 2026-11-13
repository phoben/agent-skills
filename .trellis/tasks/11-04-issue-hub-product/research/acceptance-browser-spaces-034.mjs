const spaces = await listTaskSpaces();
console.log(spaces.filter(s => /issue.hub/i.test(s.name || '')).map(s => ({ id: s.id, name: s.name, ownership: s.ownership })));
