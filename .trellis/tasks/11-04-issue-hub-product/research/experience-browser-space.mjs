const spaces=await listTaskSpaces();
console.log(spaces.filter(space=>space.id===8).map(space=>({id:space.id,name:space.name,ownership:space.ownership})));
