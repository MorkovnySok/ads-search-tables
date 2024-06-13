"use strict";
import * as vscode from "vscode";
import * as azdata from "azdata";
import { fullTableNamesSql, relationsSql } from "./sql";
import { buildRelations } from "./relationsBuilder";
import { RelationType, RelationTypeQuery, Table } from "./models";
import { processJoinSuggestion } from "./suggestionProviders/joinSuggestion";

let tableNames: Table[] = [];
let relations: RelationType[] = [];

export function activate(context: vscode.ExtensionContext) {
  let adsLog = vscode.window.createOutputChannel("ADS Search Tables");
  adsLog.appendLine("ADS Search Tables Activated");

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    "sql", // only for SQL files
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
      ) {
        // only after from or join keywords
        const text = document.getText(
          new vscode.Range(new vscode.Position(position.line, 0), position),
        );
        const match = text.match(/(from|join)\s+(\w*)$/i);
        if (!match) {
          return [];
        }

        return tableNames.map((x) => {
          const alias = setAliasFromTableName(x);
          return new vscode.CompletionItem(
            `${x.name} ${alias}`,
            vscode.CompletionItemKind.TypeParameter,
          );
        });
      },
    },
  );

  const joinSuggestionsProvider =
    vscode.languages.registerCompletionItemProvider(
      "sql", // only for SQL files
      {
        provideCompletionItems(
          document: vscode.TextDocument,
          position: vscode.Position,
        ) {
          // only after ON keyword
          const text = document.getText(
            new vscode.Range(new vscode.Position(position.line, 0), position),
          );
          const onWordMatch = text.replace("=", "").match(/on\s+(\w*)$/i);
          const joinWordMatch = text.replace("=", "").match(/join\s+(\w*)$/i);
          if (!onWordMatch && !joinWordMatch) {
            return [];
          }

          const usedTables = parseSqlQueries(document, position);
          for (const usedTable of usedTables) {
            usedTable.alias = setAliasFromTableName(usedTable, usedTables);
          }

          if (joinWordMatch) {
            return processJoinSuggestion(relations, usedTables);
          }

          if (onWordMatch) {
            // return processOnWordSuggestion(relations, usedTables);
          }
        },
      },
      "=",
      " ",
    );

  context.subscriptions.push(completionProvider);
  context.subscriptions.push(joinSuggestionsProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "ads-search-tables.helloWorld",
      async () => {
        tableNames = await executeQuery<Table>(fullTableNamesSql);
        const sqlData = await executeQuery<RelationTypeQuery>(relationsSql);
        relations = buildRelations(sqlData);
      },
    ),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}

interface IDbColumn {
  columnName: string;
}

class GenericResultMapper<T extends object> {
  constructor(private data: T) {}

  mapResult(row: any[], columnInfo: IDbColumn[]): void {
    columnInfo.forEach((column, index) => {
      const propertyName = column.columnName;
      (this.data as any)[propertyName] = row[index].displayValue;
    });
  }
}

async function executeQuery<T extends object>(sql: string): Promise<T[]> {
  const connection = await azdata.connection.getCurrentConnection();
  const uri = await azdata.connection.getUriForConnection(
    connection.connectionId,
  );
  const provider = azdata.dataprotocol.getProvidersByType(
    azdata.DataProviderType.QueryProvider,
  )[0] as azdata.QueryProvider;
  const results = await provider.runQueryAndReturn(uri, sql);

  return results.rows.map((row) => {
    const rowObject = {} as T;
    const resultMapper = new GenericResultMapper<T>(rowObject);
    resultMapper.mapResult(row, results.columnInfo as IDbColumn[]);
    return rowObject;
  });
}

function parseSqlQueries(
  document: vscode.TextDocument,
  position: vscode.Position,
): Table[] {
  const sqlText = document.getText();
  const tablesUsed: string[] = [];

  const lines = sqlText.split("\n");
  const currentLine = position.line;

  let queryStart: number | null = null;

  // Iterate from the cursor position to the beginning of the document
  for (let i = currentLine; i >= 0; i--) {
    const line = lines[i].trim();
    const selectIndex = line.search(/\b(?:SELECT|UPDATE|DELETE)\b/i);

    if (selectIndex !== -1) {
      queryStart = i;
      break;
    }
  }

  if (queryStart === null) {
    return [];
  }

  const queryLines = lines.slice(queryStart, currentLine + 1);
  const query = queryLines.join(" ");

  // Use a simple parser to extract table names
  const words = query.split(/\s+/);
  let isFromJoinClause = false;

  for (const word of words) {
    if (isFromJoinClause && word !== "") {
      tablesUsed.push(word);
      isFromJoinClause = false;
    }

    if (/\b(?:FROM|JOIN)\b/i.test(word)) {
      isFromJoinClause = true;
    }
  }

  return tablesUsed.map((x) => {
    return {
      name: x,
    } as Table;
  });
}

export function setAliasFromTableName(
  table: Table,
  tablesUsedInQuery?: Table[] | undefined,
): string {
  const nameParts = table.name.split(".");
  let tableNameWithoutSchema;
  if (nameParts.length > 1) {
    tableNameWithoutSchema = nameParts[1];
  } else {
    tableNameWithoutSchema = nameParts[0];
  }
  // returns every capital letter in the table name
  const regex = /[A-Z]/g;
  const matches = tableNameWithoutSchema.match(regex);
  if (matches) {
    let alias = matches.join("");
    if (tablesUsedInQuery) {
      const aliasUsages = tablesUsedInQuery.filter(
        (x) => x.alias === alias,
      ).length;
      alias = aliasUsages > 0 ? alias + aliasUsages.toString() : alias;
    }
    table.alias = alias;
    console.log(table.name, table.alias);
    // relations
    //   .filter((x) => x.table.name === table.name)
    //   .forEach((x) => (x.table.alias = table.alias));

    return table.alias;
  } else {
    table.alias = tableNameWithoutSchema;
    return table.alias;
  }
}
