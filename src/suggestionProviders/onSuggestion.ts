// export function processOnWordSuggestion(
//   relations: RelationType[],
//   usedTables: Table[],
// ) {
//   const currentTable = usedTables.pop();
//   const suggestedRelations = relations.filter((r) => {
//     return (
//       (usedTables.includes(r.parentTable) && r.childTable === currentTable) ||
//       (usedTables.includes(r.childTable) && r.parentTable === currentTable)
//     );
//   });
//
//   const suggestionsSet = new Set<string>(
//     suggestedRelations.map(
//       (x) =>
//         `${setAliasFromTableName(x.parentTable, usedTables)}.${
//           x.parentColumn
//         } = ${setAliasFromTableName(x.childTable, usedTables)}.${x.childColumn}`,
//     ),
//   );
//   const result: vscode.ProviderResult<
//     vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
//   > = [];
//   suggestionsSet.forEach((x) =>
//     result.push(
//       new vscode.CompletionItem(x, vscode.CompletionItemKind.TypeParameter),
//     ),
//   );
//   return result;
// }
