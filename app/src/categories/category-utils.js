export function flattenCategories(nodes, path = [], result = []) {
  nodes.forEach(node => {
    const nextPath = [...path, node.name]
    result.push({ ...node, path: nextPath.join(' / ') })
    flattenCategories(node.children || [], nextPath, result)
  })
  return result
}

