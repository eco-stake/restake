export function mapAsync(array, callbackfn) {
  return Promise.all(array.map(callbackfn));
}

export function findAsync(array, callbackfn) {
  return mapAsync(array, callbackfn).then(findMap => {
    return array.find((value, index) => findMap[index]);
  });
}

export function filterAsync(array, callbackfn) {
  return mapAsync(array, callbackfn).then(filterMap => {
    return array.filter((value, index) => filterMap[index]);
  });
}
