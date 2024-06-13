import { RelationType, Table } from "../models";
import { setAliasFromTableName } from "../extension";
import * as vscode from "vscode";

export function processJoinSuggestion(
  relations: RelationType[],
  usedTables: Table[],
): vscode.ProviderResult<
  vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
> {
  const relationsForUsedTables = relations.filter((x) =>
    usedTables.map((t) => t.name).includes(x.table.name),
  );
  const joinCandidates = relationsForUsedTables.flatMap(
    (x) => x.joinableTables,
  );

  const suggestionsSet = new Set<string>(
    joinCandidates.map((x) => {
      setAliasFromTableName(x.table, usedTables);
      return `${x.table.name} ${x.table.alias} ON ${x.parentTable.alias}.${x.parentColumn} = ${x.table.alias}.${x.column}`;
    }),
  );
  const result: vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > = [];
  suggestionsSet.forEach((x) =>
    result.push(
      new vscode.CompletionItem(x, vscode.CompletionItemKind.TypeParameter),
    ),
  );
  return result;
}
